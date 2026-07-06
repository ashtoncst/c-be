// test/unit/session-cookie.util.test.ts

/**
 * Test suite for session cookie sign/verify helpers.
 *
 * The helpers protect `/api/chat/history/:sessionId` by binding an httpOnly
 * cookie to the session_id via an HMAC-SHA256 signature. Verification is done
 * with timingSafeEqual to avoid leaking timing information.
 */

import { describe, it, expect } from "vitest";
import {
	signSessionCookie,
	verifySessionCookie,
	parseSessionCookieHeader,
} from "../../src/utils/session-cookie.util.js";

const SECRET = "unit-test-secret-value-12345";
const OTHER_SECRET = "different-secret-98765";
const SESSION_ID = "e7c9e5e8-3a51-4c27-9f28-0e1f6d4b1a02";

describe("session-cookie.util", () => {
	describe("signSessionCookie", () => {
		it("returns a cookie of the form <hex-hmac>.<sessionId>", () => {
			const cookie = signSessionCookie(SESSION_ID, SECRET);
			expect(cookie).toMatch(/^[0-9a-f]{64}\./);
			expect(cookie.endsWith("." + SESSION_ID)).toBe(true);
		});

		it("produces a stable signature for the same inputs", () => {
			const a = signSessionCookie(SESSION_ID, SECRET);
			const b = signSessionCookie(SESSION_ID, SECRET);
			expect(a).toBe(b);
		});

		it("produces a different signature for different secrets", () => {
			const a = signSessionCookie(SESSION_ID, SECRET);
			const b = signSessionCookie(SESSION_ID, OTHER_SECRET);
			expect(a).not.toBe(b);
		});

		it("produces a different signature for different session ids", () => {
			const a = signSessionCookie(SESSION_ID, SECRET);
			const b = signSessionCookie("other-session-id", SECRET);
			expect(a).not.toBe(b);
		});
	});

	describe("verifySessionCookie", () => {
		it("returns the session id when signature matches", () => {
			const cookie = signSessionCookie(SESSION_ID, SECRET);
			expect(verifySessionCookie(cookie, SECRET)).toBe(SESSION_ID);
		});

		it("returns null when signature is forged/tampered", () => {
			const cookie = signSessionCookie(SESSION_ID, SECRET);
			const forged = "0".repeat(64) + "." + SESSION_ID;
			expect(verifySessionCookie(forged, SECRET)).toBeNull();
			// Tampered last char
			const tampered = cookie.slice(0, -1) + (cookie.slice(-1) === "0" ? "1" : "0");
			expect(verifySessionCookie(tampered, SECRET)).toBeNull();
		});

		it("returns null when secret is wrong", () => {
			const cookie = signSessionCookie(SESSION_ID, SECRET);
			expect(verifySessionCookie(cookie, OTHER_SECRET)).toBeNull();
		});

		it("returns null for malformed cookie values", () => {
			expect(verifySessionCookie("", SECRET)).toBeNull();
			expect(verifySessionCookie("no-dot-here", SECRET)).toBeNull();
			expect(verifySessionCookie(".", SECRET)).toBeNull();
			expect(verifySessionCookie("only-signature.", SECRET)).toBeNull();
			expect(verifySessionCookie(".only-id", SECRET)).toBeNull();
			// Signature must be hex
			expect(verifySessionCookie("NOT-HEX." + SESSION_ID, SECRET)).toBeNull();
		});

		it("returns null for null/undefined input", () => {
			expect(verifySessionCookie(undefined, SECRET)).toBeNull();
			expect(verifySessionCookie(null as unknown as string, SECRET)).toBeNull();
		});

		it("uses constant-time comparison (sanity: equal-length buffers)", () => {
			// Best we can do here without timing-attack instrumentation: verify
			// that a signature whose length differs is rejected immediately and
			// that equal-length-but-wrong signatures also return null cleanly.
			const cookie = signSessionCookie(SESSION_ID, SECRET);
			const shortenedSig = cookie.slice(0, 63) + "." + SESSION_ID;
			expect(verifySessionCookie(shortenedSig, SECRET)).toBeNull();
		});
	});

	describe("parseSessionCookieHeader", () => {
		it("extracts cs_session value from a Cookie header", () => {
			const header = `cs_session=${signSessionCookie(SESSION_ID, SECRET)}; other=foo`;
			expect(parseSessionCookieHeader(header)).toBe(
				signSessionCookie(SESSION_ID, SECRET)
			);
		});

		it("returns null when cs_session is absent", () => {
			expect(parseSessionCookieHeader("other=foo; bar=baz")).toBeNull();
			expect(parseSessionCookieHeader("")).toBeNull();
			expect(parseSessionCookieHeader(undefined)).toBeNull();
		});

		it("handles cookies with whitespace and ordering", () => {
			const sig = signSessionCookie(SESSION_ID, SECRET);
			expect(parseSessionCookieHeader(`foo=bar; cs_session=${sig}`)).toBe(sig);
			expect(parseSessionCookieHeader(`cs_session=${sig};foo=bar`)).toBe(sig);
			expect(parseSessionCookieHeader(`cs_session=${sig} ; x=1`)).toBe(sig);
		});

		it("decodes URL-encoded cookie values", () => {
			// Session IDs are plain UUIDs so not encoded, but make sure the
			// parser tolerates encoded values for robustness.
			const raw = "abc%20def";
			expect(parseSessionCookieHeader(`cs_session=${raw}`)).toBe("abc def");
		});
	});
});
