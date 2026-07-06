// test/unit/negative-feedback-contextualization.test.ts

/**
 * D3: "No" after a recommendation should surface alternatives within the
 * same solution category. In production the deterministic "no" branch was
 * only wired into the non-streaming processMessage path — processMessageStream
 * (the Socket.IO path actually used by the frontend) skipped it entirely,
 * so "no" fell back to the generic Gemini / fallback flow and re-emitted
 * the same products.
 *
 * We unit-test the pure helper (contextualizeNegativeFeedback) that both
 * paths will call, keeping the socket plumbing out of the test.
 */

import { describe, it, expect, vi } from "vitest";
import type { ConversationContext } from "../../src/dtos/chat.dto.js";

vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(),
	})),
}));
vi.mock("../../src/services/context.service.js", () => ({
	ContextService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../src/services/catalog-cache.service.js", () => ({
	CatalogCacheService: { getInstance: vi.fn(() => ({})) },
}));
vi.mock("../../src/services/gemini-intent-classifier.service.js", () => ({
	GeminiIntentClassifierService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../src/services/topic-switch-detector.service.js", () => ({
	TopicSwitchDetectorService: vi.fn().mockImplementation(() => ({})),
}));

import { ChatService } from "../../src/services/chat.service.js";

function makeContext(over: Partial<ConversationContext> = {}): ConversationContext {
	return {
		sessionId: "sid",
		recentTurns: [],
		currentRecommendations: [],
		conversationStage: "feedback",
		userPreferences: {},
		...over,
	} as ConversationContext;
}

type Contextualizer = (message: string, context: ConversationContext) => string;

function getContextualizer(svc: ChatService): Contextualizer {
	return (svc as unknown as { contextualizeNegativeFeedback: Contextualizer })
		.contextualizeNegativeFeedback.bind(svc);
}

describe("ChatService.contextualizeNegativeFeedback", () => {
	const svc = new ChatService();
	const contextualize = getContextualizer(svc);

	it("rewrites 'no' into a prompt that stays within the prior solution", () => {
		const ctx = makeContext({
			recentTurns: [
				{
					userMessage: "I need internet",
					botResponse: "Fiber Broadband PEAK. Want to see alternatives?",
					extractedEntities: { solution: "Internet", category: "Fiber Broadband" } as ConversationContext["entities"],
					timestamp: new Date(),
				},
			],
			currentRecommendations: [
				{
					id: 1, name: "Fiber Broadband PEAK 50-100 mbps", description: "", price: null, contractTerm: null, itemType: "product", parentItem: null, targetAudience: null, features: [],
				},
			],
		});
		const rewritten = contextualize("no", ctx);
		expect(rewritten.toLowerCase()).toContain("no");
		expect(rewritten.toLowerCase()).toContain("internet");
		expect(rewritten.toLowerCase()).toMatch(/different|alternative|not.*already/);
	});

	it("returns the original message unchanged when the user is not in feedback stage", () => {
		const ctx = makeContext({ conversationStage: "discovery" });
		const rewritten = contextualize("no", ctx);
		expect(rewritten).toBe("no");
	});

	it("returns the original message unchanged when the confirmation is not negative", () => {
		const ctx = makeContext({
			recentTurns: [
				{
					userMessage: "internet",
					botResponse: "Fiber Broadband. Want alternatives?",
					extractedEntities: { solution: "Internet" } as ConversationContext["entities"],
					timestamp: new Date(),
				},
			],
			currentRecommendations: [
				{ id: 1, name: "Fiber Broadband PEAK 50-100 mbps", description: "", price: null, contractTerm: null, itemType: "product", parentItem: null, targetAudience: null, features: [] },
			],
		});
		const rewritten = contextualize("yes", ctx);
		expect(rewritten).toBe("yes");
	});

	it("returns the original message unchanged when no recommendations were shown yet", () => {
		const ctx = makeContext({ currentRecommendations: [] });
		const rewritten = contextualize("no", ctx);
		expect(rewritten).toBe("no");
	});
});
