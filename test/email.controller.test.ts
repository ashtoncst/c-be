import { vi, describe, it, expect, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("../src/services/email.service.js", () => ({
  emailService: { send: mockSend },
}));

// asyncHandler wraps async handlers; we import after mocks so the controller
// uses our mocked service.
async function loadController() {
  const mod = await import("../src/controllers/email.controller");
  return mod.emailController;
}

// asyncHandler starts the async work but doesn't return the promise.
// We wait for res.json to fire (or controller errors out) before asserting.
function mockRes() {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((body: unknown) => {
    res.body = body;
    resolveDone();
    return res as Response;
  });
  return { res, done };
}

function mockReq(body: Record<string, unknown>) {
  return { body } as unknown as Request;
}

describe("EmailController.send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue(true);
  });

  it("returns 200 { success: true } on valid newsletter payload", async () => {
    const controller = await loadController();
    const { res, done } = mockRes();
    controller.send(
      mockReq({
        type: "newsletter",
        name: "Alice",
        email: "alice@example.com",
        company: "Acme",
      }),
      res as Response,
      vi.fn()
    );

    await done;
    expect(mockSend).toHaveBeenCalledWith(
      "newsletter",
      expect.objectContaining({ name: "Alice", email: "alice@example.com" })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it("returns 400 { error: string } when type is invalid", async () => {
    const controller = await loadController();
    const { res, done } = mockRes();
    controller.send(
      mockReq({
        type: "bogus",
        name: "Alice",
        email: "alice@example.com",
        company: "Acme",
      }),
      res as Response,
      vi.fn()
    );

    await done;
    expect(mockSend).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: expect.any(String) });
    expect(String((res.body as { error: string }).error)).toContain("type");
  });

  it("returns 400 when contact is missing required fields", async () => {
    const controller = await loadController();
    const { res, done } = mockRes();
    controller.send(
      mockReq({
        type: "contact",
        name: "Alice",
        email: "alice@example.com",
        company: "Acme",
        // missing address, mobile, inquiry
      }),
      res as Response,
      vi.fn()
    );

    await done;
    expect(res.statusCode).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns 500 { error: string } when service returns false", async () => {
    mockSend.mockResolvedValueOnce(false);
    const controller = await loadController();
    const { res, done } = mockRes();
    controller.send(
      mockReq({
        type: "newsletter",
        name: "Alice",
        email: "alice@example.com",
        company: "Acme",
      }),
      res as Response,
      vi.fn()
    );

    await done;
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: expect.any(String) });
  });
});
