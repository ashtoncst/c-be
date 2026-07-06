// src/utils/session-cookie.util.ts

import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "cs_session";
const SIG_HEX_LENGTH = 64; // SHA-256 = 32 bytes = 64 hex chars
const HEX_RE = /^[0-9a-f]+$/;

function hmac(sessionId: string, secret: string): string {
	return createHmac("sha256", secret).update(sessionId).digest("hex");
}

export function signSessionCookie(sessionId: string, secret: string): string {
	return `${hmac(sessionId, secret)}.${sessionId}`;
}

export function verifySessionCookie(
	cookie: string | undefined | null,
	secret: string
): string | null {
	if (typeof cookie !== "string" || cookie.length === 0) return null;

	const dot = cookie.indexOf(".");
	if (dot <= 0 || dot === cookie.length - 1) return null;

	const providedSig = cookie.slice(0, dot);
	const sessionId = cookie.slice(dot + 1);

	if (providedSig.length !== SIG_HEX_LENGTH) return null;
	if (!HEX_RE.test(providedSig)) return null;

	const expectedSig = hmac(sessionId, secret);

	// timingSafeEqual throws if buffers differ in length; we already enforced
	// providedSig is SIG_HEX_LENGTH, and expectedSig is always the same length,
	// so the comparison is constant-time over equal-length inputs.
	const a = Buffer.from(providedSig, "hex");
	const b = Buffer.from(expectedSig, "hex");
	if (a.length !== b.length) return null;
	if (!timingSafeEqual(a, b)) return null;

	return sessionId;
}

export function parseSessionCookieHeader(
	header: string | undefined | null
): string | null {
	if (typeof header !== "string" || header.length === 0) return null;
	for (const part of header.split(";")) {
		const trimmed = part.trim();
		if (!trimmed.startsWith(COOKIE_NAME + "=")) continue;
		const raw = trimmed.slice(COOKIE_NAME.length + 1).trim();
		try {
			return decodeURIComponent(raw);
		} catch {
			return raw;
		}
	}
	return null;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
