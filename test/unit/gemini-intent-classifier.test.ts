// test/unit/gemini-intent-classifier.test.ts

/**
 * Test suite for GeminiIntentClassifierService
 *
 * Verifies classification of the three user-facing intent types
 * (product_query, clarification, comparison) plus greeting fast-path
 * and graceful fallback on malformed model output.
 *
 * model.invoke is mocked — tests are deterministic and do not hit Gemini.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeminiIntentClassifierService } from "../../src/services/gemini-intent-classifier.service.js";

// Stub API key so constructor does not complain.
process.env.GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "test-key";

type InvokeMock = ReturnType<typeof vi.fn>;

const makeModelResponse = (payload: unknown) => ({
	content: JSON.stringify(payload),
});

const mockInvoke = (service: GeminiIntentClassifierService): InvokeMock => {
	// Access private `model` field via index signature for test purposes.
	const svc = service as unknown as { model: { invoke: InvokeMock } };
	const spy = vi.fn();
	svc.model.invoke = spy;
	return spy;
};

describe("GeminiIntentClassifierService", () => {
	let service: GeminiIntentClassifierService;

	beforeEach(() => {
		service = new GeminiIntentClassifierService();
	});

	describe("fast-path greeting", () => {
		it("returns greeting without invoking the model", async () => {
			const invoke = mockInvoke(service);

			const result = await service.classifyIntent("hi");

			expect(result.intent).toBe("greeting");
			expect(result.confidence).toBeGreaterThanOrEqual(0.9);
			expect(invoke).not.toHaveBeenCalled();
		});

		it("matches 'hello' and 'good morning' variants", async () => {
			const invoke = mockInvoke(service);

			for (const greeting of ["hello", "Hey there", "Good morning"]) {
				const result = await service.classifyIntent(greeting);
				expect(result.intent).toBe("greeting");
			}

			expect(invoke).not.toHaveBeenCalled();
		});
	});

	describe("product_query classification", () => {
		it("classifies a concrete product need", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "product_query",
					confidence: 0.95,
					normalizedMessage: "I need internet for my office",
					extractedContext: { solution: "Internet" },
					reasoning: "User has a concrete connectivity need",
				})
			);

			const result = await service.classifyIntent(
				"I need internet for my office"
			);

			expect(result.intent).toBe("product_query");
			expect(result.extractedContext.solution).toBe("Internet");
			expect(invoke).toHaveBeenCalledOnce();
		});

		it("classifies a self-declared product query", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "product_query",
					confidence: 0.9,
					normalizedMessage: "I have a product query",
					extractedContext: {},
					reasoning: "Self-declaration",
				})
			);

			const result = await service.classifyIntent("I have a product query");

			expect(result.intent).toBe("product_query");
			expect(result.confidence).toBeGreaterThanOrEqual(0.9);
		});
	});

	describe("clarification classification", () => {
		it("classifies a follow-up question", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "clarification",
					confidence: 0.9,
					normalizedMessage: "Tell me more about that",
					extractedContext: {},
				})
			);

			const result = await service.classifyIntent("Tell me more about that");

			expect(result.intent).toBe("clarification");
		});

		it("classifies a self-declared clarification", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "clarification",
					confidence: 0.9,
					normalizedMessage: "I'd like a clarification",
					extractedContext: {},
				})
			);

			const result = await service.classifyIntent("I'd like a clarification");

			expect(result.intent).toBe("clarification");
		});
	});

	describe("comparison classification", () => {
		it("classifies an explicit difference question", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "comparison",
					confidence: 0.95,
					normalizedMessage: "What's the difference between fiber and SD-WAN?",
					extractedContext: {},
				})
			);

			const result = await service.classifyIntent(
				"What's the difference between fiber and SD-WAN?"
			);

			expect(result.intent).toBe("comparison");
		});

		it("classifies a self-declared comparison", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "comparison",
					confidence: 0.9,
					normalizedMessage: "I want to compare options",
					extractedContext: {},
				})
			);

			const result = await service.classifyIntent("I want to compare options");

			expect(result.intent).toBe("comparison");
		});
	});

	describe("fallback behavior", () => {
		it("falls back when the model returns malformed JSON", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue({ content: "not json at all {{{" });

			const result = await service.classifyIntent(
				"random message with no keywords"
			);

			// parseClassificationResponse failure routes to fallbackClassification("")
			// which returns "other" for unknown patterns.
			expect(["other", "off_topic", "product_query"]).toContain(result.intent);
			expect(invoke).toHaveBeenCalledOnce();
		});

		it("falls back when the model invocation throws", async () => {
			const invoke = mockInvoke(service);
			invoke.mockRejectedValue(new Error("network down"));

			const result = await service.classifyIntent(
				"some non-greeting message about business"
			);

			// fallbackClassification runs on the cleaned original message.
			expect(result).toBeDefined();
			expect(result.intent).toBeDefined();
			expect(result.reasoning).toMatch(/fallback/i);
		});
	});

	describe("prompt content (regression guard)", () => {
		it("includes few-shot examples for all three target intents", async () => {
			const invoke = mockInvoke(service);
			invoke.mockResolvedValue(
				makeModelResponse({
					intent: "product_query",
					confidence: 0.95,
					normalizedMessage: "x",
					extractedContext: {},
				})
			);

			await service.classifyIntent("I need something");

			const promptArg = invoke.mock.calls[0][0] as string;

			expect(promptArg).toContain("FEW-SHOT EXAMPLES");
			expect(promptArg).toContain("SELF-DECLARATION");
			expect(promptArg).toContain("I have a product query");
			expect(promptArg).toContain("I'd like a clarification");
			expect(promptArg).toContain("I want to compare options");
		});
	});
});
