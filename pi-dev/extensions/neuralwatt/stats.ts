/**
 * NeuralWatt account stats: footer balance and the /nw report.
 * Endpoints: /v1/quota (balance, tier; 1 req/s limit), /v1/usage/summary (cost, tokens), /v1/usage/energy (energy, CO2).
 * /nw feature and /nw router live in work.ts.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { API } from "./catalog.ts";
import { featureReport, routerReport } from "./work.ts";

const STATUS_KEY = "neuralwatt";
const REFRESH_MS = 60_000;

interface Quota {
	balance: { credits_remaining_usd: number; total_credits_usd?: number; credits_used_usd?: number };
	limits?: { rate_limit_tier?: string };
}
interface SummaryDay { date: string; requests: number; cost_usd: number; total_tokens: number }
interface Summary {
	totals: { requests: number; total_tokens: number; cached_tokens?: number; total_cost_usd: number };
	time_series: SummaryDay[];
}
interface EnergyDay { date: string; energy_kwh: number; carbon_g_co2eq?: number }
interface Energy { totals: { energy_kwh: number; carbon_g_co2eq?: number }; daily: EnergyDay[] }

async function get<T>(path: string): Promise<T> {
	const key = process.env.NEURALWATT_API_KEY;
	if (!key) throw new Error("NEURALWATT_API_KEY is not set");
	const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
	return (await res.json()) as T;
}

/** /v1/quota allows 1 request per second per customer: share one recent result between footer and /nw. */
const QUOTA_REUSE_MS = 5_000;
let quotaCache: { at: number; value: Promise<Quota> } | null = null;
function getQuota(): Promise<Quota> {
	if (quotaCache && Date.now() - quotaCache.at < QUOTA_REUSE_MS) return quotaCache.value;
	const value = get<Quota>("/quota");
	quotaCache = { at: Date.now(), value };
	value.catch(() => { quotaCache = null; });
	return value;
}

const usd = (n: number) => `$${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`;
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K` : `${n}`);
const wh = (kwh: number) => (kwh >= 1 ? `${kwh.toFixed(2)} kWh` : `${(kwh * 1000).toFixed(1)} Wh`);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function window(days: SummaryDay[], energy: EnergyDay[], from: string) {
	const s = days.filter((d) => d.date >= from);
	const e = energy.filter((d) => d.date >= from);
	return {
		requests: s.reduce((a, d) => a + d.requests, 0),
		tokens: s.reduce((a, d) => a + d.total_tokens, 0),
		cost: s.reduce((a, d) => a + d.cost_usd, 0),
		kwh: e.reduce((a, d) => a + d.energy_kwh, 0),
		co2: e.reduce((a, d) => a + (d.carbon_g_co2eq ?? 0), 0),
	};
}

async function report(): Promise<string> {
	const [quota, summary, energy] = await Promise.all([
		getQuota(),
		get<Summary>("/usage/summary"),
		get<Energy>("/usage/energy"),
	]);
	const now = new Date();
	const t = window(summary.time_series, energy.daily, isoDay(now));
	const w = window(summary.time_series, energy.daily, isoDay(new Date(now.getTime() - 6 * 86_400_000)));
	const m = summary.totals;
	const cacheRate = m.total_tokens ? ((m.cached_tokens ?? 0) / m.total_tokens) * 100 : 0;
	const perDay = w.cost / 7;
	const left = quota.balance.credits_remaining_usd;
	const runway = perDay > 0 ? `${Math.floor(left / perDay)} days at ${usd(perDay)}/day (7-day avg)` : "n/a";
	const q = quota.balance.total_credits_usd
		? `   (${usd(quota.balance.credits_used_usd ?? 0)} of ${usd(quota.balance.total_credits_usd)} credits used, tier ${quota.limits?.rate_limit_tier ?? "?"})`
		: "";
	const line = (label: string, x: ReturnType<typeof window>) =>
		`${label.padEnd(8)} ${String(x.requests).padStart(5)} req  ${tokens(x.tokens).padStart(6)} tok  ${usd(x.cost).padStart(7)}  ${wh(x.kwh).padStart(9)}  ${x.co2.toFixed(1)} g CO2`;
	return [
		`NeuralWatt balance: ${usd(left)}   runway: ${runway}${q}`,
		line("Today", t),
		line("7 days", w),
		`${"30 days".padEnd(8)} ${String(m.requests).padStart(5)} req  ${tokens(m.total_tokens).padStart(6)} tok  ${usd(m.total_cost_usd).padStart(7)}  ${wh(energy.totals.energy_kwh).padStart(9)}  ${(energy.totals.carbon_g_co2eq ?? 0).toFixed(1)} g CO2`,
		`Prompt cache hits (30 days): ${cacheRate.toFixed(0)}% of tokens`,
	].join("\n");
}

export function registerStats(pi: ExtensionAPI): void {
	let last = 0;
	async function refresh(ctx: ExtensionContext, force = false) {
		if (!process.env.NEURALWATT_API_KEY) return;
		if (!force && Date.now() - last < REFRESH_MS) return;
		last = Date.now();
		try {
			const q = await getQuota();
			ctx.ui.setStatus(STATUS_KEY, ctx.ui.theme.fg("dim", `NW ${usd(q.balance.credits_remaining_usd)}`));
		} catch {
			// Network or auth trouble must not disturb the session; keep the last value.
		}
	}
	pi.on("session_start", async (_event, ctx) => refresh(ctx, true));
	pi.on("agent_end", async (_event, ctx) => refresh(ctx));
	pi.registerCommand("nw", {
		description: "NeuralWatt balance, spend, cache and energy; `feature <slug>` cost per ticket; `router [days]` router outcomes",
		getArgumentCompletions: (prefix) =>
			["feature ", "router "].filter((c) => c.startsWith(prefix)).map((c) => ({ value: c, label: c.trim() })),
		handler: async (args, ctx) => {
			const [sub, arg] = args.trim().split(/\s+/);
			try {
				if (sub === "feature") {
					if (!arg) throw new Error("usage: /nw feature <slug>   (the .scratch/<slug> name)");
					ctx.ui.notify(await featureReport(arg.replace(/^\.scratch\//, "").replace(/\/$/, ""), ctx.cwd), "info");
					return;
				}
				if (sub === "router") {
					ctx.ui.notify(await routerReport(arg ? Number(arg) || 30 : 30), "info");
					return;
				}
				ctx.ui.notify(await report(), "info");
				await refresh(ctx, true);
			} catch (error) {
				ctx.ui.notify(`NeuralWatt stats unavailable: ${(error as Error).message}`, "error");
			}
		},
	});
}
