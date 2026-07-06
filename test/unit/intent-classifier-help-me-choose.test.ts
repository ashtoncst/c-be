// test/unit/intent-classifier-help-me-choose.test.ts

/**
 * Fast-path tests for the "Help me choose" quick-action button.
 *
 * Both the new canonical form ("Help me choose") and the legacy wrapper
 * ("I'm interested in Help me choose") must route to the same intent so the
 * clarification flow kicks in.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeminiIntentClassifierService } from "../../src/services/gemini-intent-classifier.service.js";

process.env.GOOGLE_GEMINI_API_KEY =
	process.env.GOOGLE_GEMINI_API_KEY ?? "test-key";

type InvokeMock = ReturnType<typeof vi.fn>;

const mockInvoke = (service: GeminiIntentClassifierService): InvokeMock => {
	const svc = service as unknown as { model: { invoke: InvokeMock } };
	const spy = vi.fn();
	svc.model.invoke = spy;
	return spy;
};

describe("Intent classifier — 'Help me choose' fast path", () => {
	let service: GeminiIntentClassifierService;

	beforeEach(() => {
		service = new GeminiIntentClassifierService();
	});

	it("classifies 'Help me choose' as clarification_request without calling Gemini", async () => {
		const invoke = mockInvoke(service);

		const result = await service.classifyIntent("Help me choose");

		expect(result.intent).toBe("clarification_request");
		expect(result.confidence).toBeGreaterThanOrEqual(0.9);
		expect(invoke).not.toHaveBeenCalled();
	});

	it("classifies the legacy 'I'm interested in Help me choose' wrapper the same way", async () => {
		const invoke = mockInvoke(service);

		const result = await service.classifyIntent("I'm interested in Help me choose");

		expect(result.intent).toBe("clarification_request");
		expect(invoke).not.toHaveBeenCalled();
	});

	it("is case-insensitive and tolerant of whitespace", async () => {
		const invoke = mockInvoke(service);

		for (const phrase of [
			"help me choose",
			"HELP ME CHOOSE",
			"  Help me choose  ",
			"help me choose.",
		]) {
			const result = await service.classifyIntent(phrase);
			expect(result.intent).toBe("clarification_request");
		}

		expect(invoke).not.toHaveBeenCalled();
	});

	it("does NOT match unrelated messages that happen to contain 'choose'", async () => {
		const invoke = mockInvoke(service);
		invoke.mockResolvedValue({
			content: JSON.stringify({
				intent: "product_query",
				confidence: 0.8,
				normalizedMessage: "I want to choose a plan",
				extractedContext: {},
			}),
		});

		const result = await service.classifyIntent("I want to choose a plan");
		expect(result.intent).not.toBe("clarification_request");
	});
});
