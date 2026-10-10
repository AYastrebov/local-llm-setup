/**
 * Work tags: attribute NeuralWatt sessions to a feature and ticket.
 *
 * /implement runs each worker with PI_NW_TAG=<feature>/<ticket> (the reviewer with <feature>/review).
 * The session id sent as `user` becomes `pi/<feature>/<ticket>/<session8>`, which NeuralWatt stores
 * verbatim, so /nw feature can find every attempt by prefix. Untagged sessions keep `pi-<session id>`.
 *
 * router/auto appends its decision per session to ROUTER_LOG, keyed by the same session id, so
 * /nw router can compare what the qualifier chose with what the ticket then needed.
 */

import { homedir } from "node:os";
import { join } from "node:path";

export const ROUTER_LOG = join(homedir(), ".pi", "agent", "router-log.jsonl");

/** Feature/ticket from PI_NW_TAG, reduced to characters safe in a session id. */
export function workTag(): string | undefined {
	const raw = process.env.PI_NW_TAG?.trim();
	if (!raw) return undefined;
	const tag = raw.replace(/[^A-Za-z0-9._/-]/g, "-").replace(/\/+/g, "/").replace(/^\/|\/$/g, "").slice(0, 160);
	return tag || undefined;
}

/** The NeuralWatt session id for a pi session: tagged work gets a searchable path. */
export function sessionUser(sessionId: string, tag = workTag()): string {
	// pi session ids are UUIDv7: the head is a timestamp, so take the random tail to keep workers apart.
	return (tag ? `pi/${tag}/${sessionId.replace(/-/g, "").slice(-8)}` : `pi-${sessionId}`).slice(0, 256);
}

export interface RouterLogEntry {
	ts: string;
	user: string;
	tag?: string;
	/** plan: first routing of the session; switch: planning model handed over after the first edit. */
	event: "plan" | "switch";
	/** clef: clef-flash decided; qualifier: the nw-flash chat fallback answered; kept: session already on a
	 * planning model; fallback: both failed, standard by default. */
	source?: "clef" | "qualifier" | "kept" | "fallback";
	verdict?: "complex" | "standard";
	/** clef-flash's P(complex), when it decided. */
	pComplex?: number;
	model: string;
}
