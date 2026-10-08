/**
 * NeuralWatt for pi: one extension instead of a models.json block plus a stats extension.
 *
 * - Provider `neuralwatt` (OpenAI Chat Completions) with a live catalog from GET /v1/models
 *   (catalog.ts; edit MODEL_IDS there). Key from NEURALWATT_API_KEY.
 * - Every NeuralWatt request carries `user = pi-<session id>` (one value per conversation, as the docs
 *   require): `user` is NeuralWatt's documented cache-affinity routing key (same server → warm prefix
 *   cache) and wins as the session id in Dashboard → Sessions. `metadata.conversation_id` carries the
 *   same value for grouping. Body fields, because header hooks cannot see which provider a
 *   router/auto request goes to; the payload names the real model.
 * - PI_NW_FLEX=1 (set by /implement workers and /review): `service_tier: "flex"` on NeuralWatt
 *   requests — same model and cache, 35% cheaper, may wait for capacity before starting.
 * - Hosted tools (preview): on models whose catalog entry says `hosted_tools: true` for this key, requests
 *   that already declare tools also name PI_NW_HOSTED_TOOLS (default nw_web_search,nw_look,nw_check_budget;
 *   "none" disables) — opt-in per request, so the account-wide dashboard switches can stay off and other
 *   clients on the account (Hermes) are unaffected. The gateway runs them inside the response; pi never sees
 *   the calls. Delegated work is capped per request by metadata.hosted_tools_budget.max_cost_usd
 *   (PI_NW_HOSTED_TOOLS_BUDGET_USD, default 0.25).
 * - Footer balance and /nw report (stats.ts).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API, loadModels, type ModelDef } from "./catalog.ts";
import { registerStats } from "./stats.ts";

const COMPAT = { supportsDeveloperRole: false, supportsReasoningEffort: true, supportsUsageInStreaming: true };

const withCompat = (defs: ModelDef[]) => defs.map(({ hostedTools: _, ...d }) => ({ ...d, compat: { ...COMPAT, ...d.compat } }));

const HOSTED_TOOLS = (process.env.PI_NW_HOSTED_TOOLS ?? "nw_web_search,nw_look,nw_check_budget")
	.split(",").map((t) => t.trim()).filter((t) => t.startsWith("nw_"));
const HOSTED_BUDGET_USD = Number(process.env.PI_NW_HOSTED_TOOLS_BUDGET_USD ?? "0.25");

type ChatTool = { type?: string; function?: { name?: string } };

/** Name the hosted tools after the client's own tools (the gateway places them there anyway, keeping the
 * prompt prefix identical turn to turn). Skips requests without tools, e.g. compaction summaries. */
function withHostedTools(tools: ChatTool[] | undefined): ChatTool[] | undefined {
	if (!tools || tools.length === 0 || HOSTED_TOOLS.length === 0) return undefined;
	const have = new Set(tools.map((t) => t.function?.name));
	const extra = HOSTED_TOOLS.filter((n) => !have.has(n)).map((name) => ({ type: "function", function: { name } }));
	return extra.length ? [...tools, ...extra] : undefined;
}

export default async function (pi: ExtensionAPI) {
	const models = await loadModels();
	const ids = new Set(models.map((m) => m.id));
	const hosted = new Set(models.filter((m) => m.hostedTools).map((m) => m.id));

	pi.registerProvider("neuralwatt", {
		name: "NeuralWatt",
		baseUrl: API,
		apiKey: "$NEURALWATT_API_KEY",
		api: "openai-completions",
		models: withCompat(models),
		async refreshModels(context) {
			const fresh = await loadModels(context.signal, true);
			ids.clear();
			hosted.clear();
			for (const m of fresh) {
				ids.add(m.id);
				if (m.hostedTools) hosted.add(m.id);
			}
			return withCompat(fresh);
		},
	});

	const flex = process.env.PI_NW_FLEX === "1";
	pi.on("before_provider_request", (event, ctx) => {
		const payload = event.payload as
			| { model?: string; user?: string; metadata?: Record<string, unknown>; service_tier?: string; tools?: ChatTool[] }
			| null;
		if (!payload?.model || !ids.has(payload.model)) return payload;
		const id = ctx.sessionManager.getSessionId();
		const metadata: Record<string, unknown> = { ...payload.metadata };
		if (id) metadata.conversation_id = `pi-${id}`.slice(0, 256);
		const tools = hosted.has(payload.model) ? withHostedTools(payload.tools) : undefined;
		if (tools && HOSTED_BUDGET_USD > 0) metadata.hosted_tools_budget = { max_cost_usd: HOSTED_BUDGET_USD };
		return {
			...payload,
			...(id ? { user: payload.user ?? `pi-${id}` } : {}),
			metadata,
			...(tools ? { tools } : {}),
			...(flex && !payload.service_tier ? { service_tier: "flex" } : {}),
		};
	});

	registerStats(pi);
}
