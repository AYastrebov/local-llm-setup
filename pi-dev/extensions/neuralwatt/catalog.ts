/**
 * NeuralWatt model catalog for pi, built from `GET /v1/models` (authenticated when NEURALWATT_API_KEY
 * is set, so granted preview models are included; scope must then be "customer"):
 * prices, context/output limits, vision, and a thinking-level map derived from each model's
 * supported reasoning efforts. Cached for an hour; falls back to the last cache, then to SNAPSHOT.
 */

import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const API = "https://api.neuralwatt.com/v1";

/** Models offered in pi, in /model order. Edit to add or drop models; variants (-flex/-fast/-speed) stay hidden. */
export const MODEL_IDS = ["glm-5.3-flash", "glm-5.3", "mimo-v2.6-pro", "nw-flash", "nw-small", "nw-large"];

const CACHE_FILE = join(homedir(), ".cache", "pi-neuralwatt", "models.json");
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_TOKENS_CAP = 65_536;

interface CatalogModel {
	id: string;
	max_model_len: number;
	metadata: {
		display_name?: string;
		huggingface_id?: string;
		pricing?: { input_per_million?: number; output_per_million?: number; cached_input_per_million?: number | null };
		capabilities?: { vision?: boolean; reasoning?: boolean; reasoning_effort?: boolean; task?: string };
		reasoning?: { mandatory?: boolean; supported_efforts?: string[] };
		limits?: { max_output_tokens?: number | null };
		deprecated?: boolean;
	};
}

/** pi model definition (ProviderModelConfig shape). */
export interface ModelDef {
	id: string;
	name: string;
	reasoning: boolean;
	input: ("text" | "image")[];
	contextWindow: number;
	maxTokens: number;
	cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
	thinkingLevelMap?: Record<string, string | null>;
	compat?: Record<string, boolean>;
}

/** Last known-good definitions (2026-10-05), used when the API and the cache are both unavailable. */
const SNAPSHOT: ModelDef[] = [
	{ id: "glm-5.3-flash", name: "GLM 5.3 Flash", reasoning: true, input: ["text", "image"], contextWindow: 1048560, maxTokens: 65536, cost: { input: 0.15, output: 0.5, cacheRead: 0.03, cacheWrite: 0 }, thinkingLevelMap: { off: null } },
	{ id: "glm-5.3", name: "GLM 5.3", reasoning: true, input: ["text"], contextWindow: 1048560, maxTokens: 65536, cost: { input: 1.45, output: 4.5, cacheRead: 0.145, cacheWrite: 0 }, thinkingLevelMap: { off: null } },
	{ id: "mimo-v2.6-pro", name: "MiMo V2.6 Pro", reasoning: true, input: ["text", "image"], contextWindow: 1048560, maxTokens: 65536, cost: { input: 0.87, output: 1.74, cacheRead: 0.036, cacheWrite: 0 }, thinkingLevelMap: { off: "none" } },
	{ id: "nw-flash", name: "Neuralwatt Flash", reasoning: true, input: ["text", "image"], contextWindow: 1048560, maxTokens: 65536, cost: { input: 0.15, output: 0.6, cacheRead: 0.015, cacheWrite: 0 }, thinkingLevelMap: { off: "none" } },
	{ id: "nw-small", name: "Neuralwatt Small", reasoning: true, input: ["text", "image"], contextWindow: 262128, maxTokens: 65536, cost: { input: 0.45, output: 3.2, cacheRead: 0.25, cacheWrite: 0 }, thinkingLevelMap: { off: "none" } },
	{ id: "nw-large", name: "Neuralwatt Large", reasoning: true, input: ["text", "image"], contextWindow: 1048560, maxTokens: 65536, cost: { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 0 }, thinkingLevelMap: { off: "none" } },
];

function toDef(m: CatalogModel): ModelDef {
	const md = m.metadata ?? {};
	const p = md.pricing ?? {};
	const efforts = md.reasoning?.supported_efforts ?? [];
	const target = md.huggingface_id?.split("/").pop();
	const def: ModelDef = {
		id: m.id,
		name: m.id.startsWith("nw-") && target ? `${md.display_name ?? m.id} (→ ${target})` : (md.display_name ?? m.id),
		reasoning: md.capabilities?.reasoning !== false,
		input: md.capabilities?.vision ? ["text", "image"] : ["text"],
		contextWindow: m.max_model_len,
		maxTokens: Math.min(md.limits?.max_output_tokens ?? MAX_TOKENS_CAP, MAX_TOKENS_CAP),
		cost: { input: p.input_per_million ?? 0, output: p.output_per_million ?? 0, cacheRead: p.cached_input_per_million ?? 0, cacheWrite: 0 },
	};
	// NeuralWatt accepts every pi level name and aliases it onto the model's efforts; only "off" needs care:
	// "none" where the model can stop reasoning, unsupported where reasoning is mandatory.
	if (md.capabilities?.reasoning_effort === false) def.compat = { supportsReasoningEffort: false };
	else def.thinkingLevelMap = { off: efforts.includes("none") ? "none" : null };
	return def;
}

function select(models: CatalogModel[]): ModelDef[] {
	// Skip deprecated models and non-chat ones (capabilities.task: "embed" / "decision").
	const byId = new Map(models.filter((m) => !m.metadata?.deprecated && !m.metadata?.capabilities?.task).map((m) => [m.id, m]));
	return MODEL_IDS.flatMap((id) => {
		const m = byId.get(id);
		return m ? [toDef(m)] : [];
	});
}

function readCache(maxAgeMs: number): CatalogModel[] | null {
	try {
		if (Date.now() - statSync(CACHE_FILE).mtimeMs > maxAgeMs) return null;
		return JSON.parse(readFileSync(CACHE_FILE, "utf8")) as CatalogModel[];
	} catch {
		return null;
	}
}

/** Fresh cache → live API (refreshing the cache) → stale cache → SNAPSHOT. Never throws. */
export async function loadModels(signal?: AbortSignal, force = false): Promise<ModelDef[]> {
	const fresh = force ? null : readCache(CACHE_TTL_MS);
	if (fresh) return select(fresh);
	try {
		const key = process.env.NEURALWATT_API_KEY;
		const res = await fetch(`${API}/models`, {
			headers: key ? { Authorization: `Bearer ${key}` } : {},
			signal: signal ?? AbortSignal.timeout(5_000),
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const body = (await res.json()) as { data: CatalogModel[]; scope?: string };
		// A request that silently lost its credentials still gets 200 with the public catalog.
		if (key && body.scope && body.scope !== "customer") throw new Error(`catalog scope ${body.scope}`);
		const data = body.data;
		mkdirSync(dirname(CACHE_FILE), { recursive: true });
		writeFileSync(CACHE_FILE, JSON.stringify(data));
		const defs = select(data);
		if (defs.length > 0) return defs;
	} catch {
		// fall through to the stale cache / snapshot
	}
	const stale = readCache(Number.POSITIVE_INFINITY);
	const defs = stale ? select(stale) : [];
	return defs.length > 0 ? defs : SNAPSHOT;
}
