// test/integration/chat-reset.integration.test.ts

/**
 * Integration test for POST /api/chat/reset/:session_id
 *
 * UAT context: the frontend reset button only cleared client state. The
 * backend held on to the conversation history in `chatConversations`, so the
 * next message on the same session re-loaded that history into the LLM
 * context — causing leaked "hospital", "bank", "20" mentions across topics.
 * Fix: add a real reset endpoint that deletes the rows.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";

import { signSessionCookie, SESSION_COOKIE_NAME } from "../../src/utils/session-cookie.util.js";

// Mock ChatService — we only care about routing + middleware + the resetSession
// call signature here.
const mockResetSession = vi.fn();
const mockGetChatHistory = vi.fn();
vi.mock("../../src/services/chat.service.js", () => ({
  ChatService: class {
    resetSession = mockResetSession;
    getChatHistory = mockGetChatHistory;
  },
}));

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

describe("POST /api/chat/reset/:session_id", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.SESSION_COOKIE_SECRET;
    mockResetSession.mockResolvedValue({ deletedRows: 3 });
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.SESSION_COOKIE_SECRET;
    else process.env.SESSION_COOKIE_SECRET = originalSecret;
  });

  it("without SESSION_COOKIE_SECRET: returns 200 and calls resetSession (legacy back-compat)", async () => {
    delete process.env.SESSION_COOKIE_SECRET;

    const res = await request(buildApp()).post(`/api/chat/reset/${SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(mockResetSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("with SESSION_COOKIE_SECRET: returns 200 when cookie matches", async () => {
    process.env.SESSION_COOKIE_SECRET = SECRET;
    const cookie = `${SESSION_COOKIE_NAME}=${signSessionCookie(SESSION_ID, SECRET)}`;

    const res = await request(buildApp())
      .post(`/api/chat/reset/${SESSION_ID}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(mockResetSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("with SESSION_COOKIE_SECRET: returns 401 when cookie is missing", async () => {
    process.env.SESSION_COOKIE_SECRET = SECRET;

    const res = await request(buildApp()).post(`/api/chat/reset/${SESSION_ID}`);

    expect(res.status).toBe(401);
    expect(mockResetSession).not.toHaveBeenCalled();
  });

  it("with SESSION_COOKIE_SECRET: returns 403 when cookie is for a different session", async () => {
    process.env.SESSION_COOKIE_SECRET = SECRET;
    const cookie = `${SESSION_COOKIE_NAME}=${signSessionCookie(
      OTHER_SESSION_ID,
      SECRET
    )}`;

    const res = await request(buildApp())
      .post(`/api/chat/reset/${SESSION_ID}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(mockResetSession).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid (non-UUID) session id", async () => {
    delete process.env.SESSION_COOKIE_SECRET;

    const res = await request(buildApp()).post("/api/chat/reset/not-a-uuid");

    expect(res.status).toBe(400);
    expect(mockResetSession).not.toHaveBeenCalled();
  });

  it("returns 400 for the literal string 'null' as session id", async () => {
    delete process.env.SESSION_COOKIE_SECRET;

    const res = await request(buildApp()).post("/api/chat/reset/null");

    expect(res.status).toBe(400);
    expect(mockResetSession).not.toHaveBeenCalled();
  });

  it("is idempotent — succeeds even when there's nothing to delete", async () => {
    delete process.env.SESSION_COOKIE_SECRET;
    mockResetSession.mockResolvedValueOnce({ deletedRows: 0 });

    const res = await request(buildApp()).post(`/api/chat/reset/${SESSION_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
