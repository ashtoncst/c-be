// test/integration/chat-session-auth.test.ts

/**
 * Integration tests for:
 *   - POST /api/chat/session (creates session + sets signed httpOnly cookie)
 *   - GET  /api/chat/history/:session_id (feature-flagged cookie auth)
 *
 * The feature flag is the SESSION_COOKIE_SECRET env var.
 *  - Unset  → middleware passes through (back-compat, legacy clients keep working)
 *  - Set    → middleware enforces cookie ↔ URL param match
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import {
	signSessionCookie,
	SESSION_COOKIE_NAME,
} from "../../src/utils/session-cookie.util.js";

// Mock the ChatService entirely; we only care about routing + middleware.
const mockGetChatHistory = vi.fn();
vi.mock("../../src/services/chat.service.js", () => ({
	ChatService: class {
		getChatHistory = mockGetChatHistory;
	},
}));

// Import routes after the mock is installed.
const { default: chatRoutes } = await import(
	"../../src/routes/chat.routes.js"
);

const SESSION_ID = "e7c9e5e8-3a51-4c27-9f28-0e1f6d4b1a02";
const OTHER_SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SECRET = "integration-test-secret";

function buildApp(): express.Application {
	const app = express();
	app.use(express.json());
	app.use("/api/chat", chatRoutes);
	return app;
}

describe("Chat session + history auth", () => {
	let originalSecret: string | undefined;

	beforeEach(() => {
		originalSecret = process.env.SESSION_COOKIE_SECRET;
		mockGetChatHistory.mockResolvedValue([
			{ userMessage: "hi", botResponse: "hello" },
		]);
	});

	afterEach(() => {
		if (originalSecret === undefined) delete process.env.SESSION_COOKIE_SECRET;
		else process.env.SESSION_COOKIE_SECRET = originalSecret;
	});

	// ---------- POST /api/chat/session ----------
	describe("POST /api/chat/session", () => {
		it("without SESSION_COOKIE_SECRET: returns a session_id, no Set-Cookie", async () => {
			delete process.env.SESSION_COOKIE_SECRET;

			const res = await request(buildApp()).post("/api/chat/session");

			expect(res.status).toBe(200);
			expect(res.body).toHaveProperty("session_id");
			expect(res.body.session_id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);
			expect(res.headers["set-cookie"]).toBeUndefined();
		});

		it("with SESSION_COOKIE_SECRET: sets a signed httpOnly Set-Cookie and returns the session_id", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;

			const res = await request(buildApp()).post("/api/chat/session");

			expect(res.status).toBe(200);
			expect(res.body.session_id).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
			);

			const setCookie = res.headers["set-cookie"];
			expect(Array.isArray(setCookie)).toBe(true);
			const cookie = (setCookie as unknown as string[])[0];
			expect(cookie).toContain(`${SESSION_COOKIE_NAME}=`);
			expect(cookie).toContain("HttpOnly");
			expect(cookie).toMatch(/SameSite=Lax/i);
			expect(cookie).toContain("Path=/");
			// No Max-Age / Expires → session-scoped cookie
			expect(cookie).not.toMatch(/Max-Age=/i);
			expect(cookie).not.toMatch(/Expires=/i);
		});

		it("the Set-Cookie signature matches the returned session_id", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;

			const res = await request(buildApp()).post("/api/chat/session");
			const cookie = (res.headers["set-cookie"] as unknown as string[])[0];
			const m = cookie.match(/cs_session=([^;]+)/);
			expect(m).toBeTruthy();
			expect(m![1]).toBe(signSessionCookie(res.body.session_id, SECRET));
		});
	});

	// ---------- GET /api/chat/history/:session_id ----------
	describe("GET /api/chat/history/:session_id", () => {
		it("with flag OFF: allows any request (back-compat)", async () => {
			delete process.env.SESSION_COOKIE_SECRET;

			const res = await request(buildApp()).get(
				`/api/chat/history/${SESSION_ID}`
			);
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
		});

		it("rejects literal 'null' session id with 400", async () => {
			delete process.env.SESSION_COOKIE_SECRET;
			const res = await request(buildApp()).get("/api/chat/history/null");
			expect(res.status).toBe(400);
		});

		it("rejects non-UUID session id with 400", async () => {
			delete process.env.SESSION_COOKIE_SECRET;
			const res = await request(buildApp()).get("/api/chat/history/not-a-uuid");
			expect(res.status).toBe(400);
		});

		it("with flag ON: no cookie → 401", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;
			const res = await request(buildApp()).get(
				`/api/chat/history/${SESSION_ID}`
			);
			expect(res.status).toBe(401);
		});

		it("with flag ON: cookie for a different session → 403", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;
			const signed = signSessionCookie(OTHER_SESSION_ID, SECRET);
			const res = await request(buildApp())
				.get(`/api/chat/history/${SESSION_ID}`)
				.set("Cookie", `${SESSION_COOKIE_NAME}=${signed}`);
			expect(res.status).toBe(403);
		});

		it("with flag ON: tampered cookie → 401", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;
			const signed = signSessionCookie(SESSION_ID, SECRET);
			const tampered = signed.slice(0, -1) + (signed.slice(-1) === "0" ? "1" : "0");
			const res = await request(buildApp())
				.get(`/api/chat/history/${SESSION_ID}`)
				.set("Cookie", `${SESSION_COOKIE_NAME}=${tampered}`);
			expect(res.status).toBe(401);
		});

		it("with flag ON: matching cookie → 200 with transcript", async () => {
			process.env.SESSION_COOKIE_SECRET = SECRET;
			mockGetChatHistory.mockResolvedValue([
				{ userMessage: "hi", botResponse: "hello" },
			]);

			const signed = signSessionCookie(SESSION_ID, SECRET);
			const res = await request(buildApp())
				.get(`/api/chat/history/${SESSION_ID}`)
				.set("Cookie", `${SESSION_COOKIE_NAME}=${signed}`);

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.session_id).toBe(SESSION_ID);
			expect(mockGetChatHistory).toHaveBeenCalledWith(SESSION_ID);
		});
	});
});
