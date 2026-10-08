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
 * - Footer balance and /nw report (stats.ts).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { API, loadModels, type ModelDef } from "./catalog.ts";
import { registerStats } from "./stats.ts";

const COMPAT = { supportsDeveloperRole: false, supportsReasoningEffort: true, supportsUsageInStreaming: true };

const withCompat = (defs: ModelDef[]) => defs.map((d) => ({ ...d, compat: { ...COMPAT, ...d.compat } }));

export default async function (pi: ExtensionAPI) {
	const models = await loadModels();
	const ids = new Set(models.map((m) => m.id));

	pi.registerProvider("neuralwatt", {
		name: "NeuralWatt",
		baseUrl: API,
		apiKey: "$NEURALWATT_API_KEY",
		api: "openai-completions",
		models: withCompat(models),
		async refreshModels(context) {
			const fresh = await loadModels(context.signal, true);
			ids.clear();
			for (const m of fresh) ids.add(m.id);
			return withCompat(fresh);
		},
	});

	const flex = process.env.PI_NW_FLEX === "1";
	pi.on("before_provider_request", (event, ctx) => {
		const payload = event.payload as { model?: string; user?: string; metadata?: Record<string, unknown>; service_tier?: string } | null;
		if (!payload?.model || !ids.has(payload.model)) return payload;
		const id = ctx.sessionManager.getSessionId();
		return {
			...payload,
			...(id ? { user: payload.user ?? `pi-${id}`, metadata: { ...payload.metadata, conversation_id: `pi-${id}`.slice(0, 256) } } : {}),
			...(flex && !payload.service_tier ? { service_tier: "flex" } : {}),
		};
	});

	registerStats(pi);
}
