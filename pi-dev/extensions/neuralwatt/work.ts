/**
 * Cost per feature and router outcomes, from NeuralWatt's Sessions API (beta) joined with the
 * router log. Both rely on /implement tagging its workers (tags.ts).
 *
 *   /nw feature <slug>   every ticket of .scratch/<slug>: router verdict per run, runs, status, cost, cache
 *   /nw router [days]    by the router's first verdict: tickets, first-run passes, cost per ticket
 *
 * A ticket's runs are its worker sessions; /implement retries a failed ticket once, so one run means it
 * passed first time (or was stopped). The Sessions API allows 20 requests/minute, so reports only.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { API } from "./catalog.ts";
import { ROUTER_LOG, type RouterLogEntry } from "./tags.ts";

interface Session {
	session_id: string;
	turns: number;
	cost_usd: number;
	cache_hit_fraction: number;
	started_at: string;
	models?: string[];
}

const PAGE = 200;
const MAX_PAGES = 10;

async function sessions(days: number): Promise<Session[]> {
	const key = process.env.NEURALWATT_API_KEY;
	if (!key) throw new Error("NEURALWATT_API_KEY is not set");
	const start = new Date(Date.now() - days * 86_400_000).toISOString();
	const out: Session[] = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const url = `${API}/usage/sessions?start_date=${encodeURIComponent(start)}&limit=${PAGE}&offset=${page * PAGE}`;
		const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15_000) });
		if (res.status === 404) throw new Error("the Sessions API is not enabled for this account");
		if (!res.ok) throw new Error(`/usage/sessions: HTTP ${res.status}`);
		const batch = ((await res.json()) as { sessions?: Session[] }).sessions ?? [];
		out.push(...batch);
		if (batch.length < PAGE) break;
	}
	return out;
}

/** First plan decision per session id (a resumed session can log again; the first one routed the work). */
function routerPlans(): Map<string, RouterLogEntry> {
	const plans = new Map<string, RouterLogEntry>();
	if (!existsSync(ROUTER_LOG)) return plans;
	for (const line of readFileSync(ROUTER_LOG, "utf8").split("\n")) {
		if (!line.trim()) continue;
		try {
			const e = JSON.parse(line) as RouterLogEntry;
			if (e.event === "plan" && !plans.has(e.user)) plans.set(e.user, e);
		} catch {}
	}
	return plans;
}

interface Run {
	session: Session;
	plan?: RouterLogEntry;
}

/** pi/<feature>/<ticket>/<id8> → runs grouped by "<feature>/<ticket>", oldest run first. */
function ticketRuns(all: Session[], plans: Map<string, RouterLogEntry>, feature?: string): Map<string, Run[]> {
	const byTicket = new Map<string, Run[]>();
	for (const s of all) {
		const parts = s.session_id.split("/");
		if (parts[0] !== "pi" || parts.length < 4) continue;
		const key = parts.slice(1, -1).join("/");
		if (feature && parts.slice(1, -2).join("/") !== feature) continue;
		const runs = byTicket.get(key) ?? [];
		runs.push({ session: s, plan: plans.get(s.session_id) });
		byTicket.set(key, runs);
	}
	for (const runs of byTicket.values()) runs.sort((a, b) => a.session.started_at.localeCompare(b.session.started_at));
	return byTicket;
}

const usd = (n: number) => `$${n.toFixed(n < 0.01 ? 4 : n < 1 ? 3 : 2)}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const sum = (runs: Run[]) => runs.reduce((a, r) => a + r.session.cost_usd, 0);

/** Cache hits weighted by cost, so a one-turn qualifier-sized run does not skew a ticket. */
function cache(runs: Run[]): number {
	const w = sum(runs);
	if (w === 0) return runs.reduce((a, r) => a + r.session.cache_hit_fraction, 0) / Math.max(runs.length, 1);
	return runs.reduce((a, r) => a + r.session.cache_hit_fraction * r.session.cost_usd, 0) / w;
}

function describe(run: Run): string {
	const p = run.plan;
	if (!p) return run.session.models?.join("+") ?? "?";
	const how = p.source === "qualifier" ? p.verdict : `${p.verdict}(${p.source})`;
	return `${how}→${p.model}`;
}

function ticketStatus(cwd: string, feature: string, ticket: string): string {
	const dir = join(cwd, ".scratch", feature, "issues");
	if (!existsSync(dir)) return "";
	const file = readdirSync(dir).find((f) => f.startsWith(`${ticket}-`) || f === `${ticket}.md`);
	if (!file) return "";
	return /^Status:\s*(\w+)/m.exec(readFileSync(join(dir, file), "utf8"))?.[1] ?? "";
}

export async function featureReport(feature: string, cwd: string, days = 30): Promise<string> {
	const byTicket = ticketRuns(await sessions(days), routerPlans(), feature);
	if (byTicket.size === 0) {
		return `No NeuralWatt sessions tagged ${feature}/… in the last ${days} days (workers need PI_NW_TAG=${feature}/<ticket>).`;
	}
	const keys = [...byTicket.keys()].sort((a, b) => (a.endsWith("/review") ? 1 : b.endsWith("/review") ? -1 : a.localeCompare(b)));
	const all = [...byTicket.values()].flat();
	const lines = keys.map((key) => {
		const runs = byTicket.get(key)!;
		const ticket = key.split("/").pop()!;
		const status = ticket === "review" ? "" : ticketStatus(cwd, feature, ticket);
		const run = `${runs.length} run${runs.length > 1 ? "s" : ""}`;
		return `${ticket.padEnd(7)} ${status.padEnd(8)} ${run.padEnd(7)} ${usd(sum(runs)).padStart(7)}  cache ${pct(cache(runs)).padStart(4)}  ${runs.map(describe).join(", ")}`;
	});
	const tickets = keys.filter((k) => !k.endsWith("/review")).length;
	return [
		`${feature}: ${tickets} tickets, ${all.length} sessions, ${usd(sum(all))}, cache ${pct(cache(all))} (last ${days} days; coordinator session not included)`,
		...lines,
	].join("\n");
}

export async function routerReport(days = 30): Promise<string> {
	const byTicket = ticketRuns(await sessions(days), routerPlans());
	const groups = new Map<string, { tickets: number; firstRun: number; cost: number; firstCost: number }>();
	let untracked = 0;
	for (const [key, runs] of byTicket) {
		if (key.endsWith("/review")) continue;
		const first = runs[0].plan;
		if (!first) {
			untracked++;
			continue;
		}
		const label = first.source === "fallback" ? "standard (qualifier failed)" : first.verdict ?? "?";
		const g = groups.get(label) ?? { tickets: 0, firstRun: 0, cost: 0, firstCost: 0 };
		g.tickets++;
		if (runs.length === 1) g.firstRun++;
		g.cost += sum(runs);
		g.firstCost += runs[0].session.cost_usd;
		groups.set(label, g);
	}
	if (groups.size === 0) {
		return `No router/auto worker tickets in the last ${days} days${untracked ? ` (${untracked} tagged tickets ran without router/auto)` : ""}.`;
	}
	const rows = [...groups].map(
		([label, g]) =>
			`${label.padEnd(28)} ${String(g.tickets).padStart(4)}  ${`${g.firstRun}/${g.tickets} (${pct(g.firstRun / g.tickets)})`.padStart(13)}  ${usd(g.cost / g.tickets).padStart(8)}  ${usd(g.firstCost / g.tickets).padStart(8)}`,
	);
	return [
		`router/auto, last ${days} days, by the first run's verdict`,
		`${"verdict".padEnd(28)} ${"tix".padStart(4)}  ${"first-run ok".padStart(13)}  ${"$/ticket".padStart(8)}  ${"1st run".padStart(8)}`,
		...rows,
		"A low first-run rate for standard means the qualifier under-rates; a high one for complex at a much",
		"higher $/ticket means it over-rates. Retried runs are counted in $/ticket.",
		...(untracked ? [`(${untracked} tagged tickets ran without router/auto and are not counted)`] : []),
	].join("\n");
}
