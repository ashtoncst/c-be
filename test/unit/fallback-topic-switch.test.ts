// test/unit/fallback-topic-switch.test.ts

/**
 * Fallback routing regression (D1).
 *
 * Scenario: Gemini is down. User asks about Internet in turn 1. Fallback
 * replies with Fiber Broadband and context.entities is cached with
 * category="internet". User switches topic in turn 2 ("What security
 * services do you have?"). Gemini is STILL down, so the fallback runs
 * again — but the cached `context.entities` from turn 1 makes it ignore
 * the new category signal and return Fiber Broadband again.
 *
 * Expected: the fallback re-extracts entities from the CURRENT message
 * first. If the current message clearly mentions a different category,
 * that takes priority over any cached / historical category.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CatalogItem } from "../../src/types/catalog.types.js";
import type { ConversationContext } from "../../src/dtos/chat.dto.js";

// Keep the LangChain constructor dependencies inert so we can exercise the
// fallback code path without spinning up real Gemini / logger plumbing.
vi.mock("@langchain/google-genai", () => ({
	ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		invoke: vi.fn().mockRejectedValue(new Error("gemini down")),
	})),
}));
vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(),
	})),
}));
vi.mock("../../src/utils/langchain-logger.js", () => ({
	LangChainLogger: vi.fn().mockImplementation(() => ({
		info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn(),
	})),
	LangChainErrorType: {},
}));
vi.mock("../../src/utils/langchain-errors.js", () => ({
	LangChainErrorHandler: vi.fn().mockImplementation(() => ({ handle: vi.fn() })),
}));
vi.mock("../../src/services/catalog-lexicon.service.js", () => ({
	CatalogLexiconService: vi.fn().mockImplementation(() => ({ getSynonyms: vi.fn(() => []) })),
}));
vi.mock("../../src/services/catalog-cache.service.js", () => ({
	CatalogCacheService: {
		getInstance: vi.fn(() => ({
			buildHierarchy: vi.fn(() => []),
			getCatalog: vi.fn(async () => ({ flat: [], hierarchical: [], metadata: { itemCount: 0, solutionCount: 0 } })),
		})),
	},
}));

import { LangChainService } from "../../src/services/langchain.service.js";

function makeProduct(id: number, name: string): CatalogItem {
	return {
		id,
		name,
		description: name,
		type: "product",
		parentId: null,
		price: null,
		contractTerm: null,
		targetAudienceId: null,
	} as CatalogItem;
}

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
	return {
		sessionId: "test-session",
		recentTurns: [],
		currentRecommendations: [],
		conversationStage: "discovery",
		userPreferences: {},
		...overrides,
	} as ConversationContext;
}

describe("LangChainService fallback — topic switch respects current message", () => {
	let service: LangChainService;

	beforeEach(() => {
		service = new LangChainService();
	});

	// A catalog with BOTH internet and security products. Fiber comes first
	// (the production bug returns these for every query). If routing is
	// correct, a security question should surface security products.
	const catalog: CatalogItem[] = [
		makeProduct(1, "Fiber Broadband PEAK 50-100 mbps"),
		makeProduct(2, "Fiber Broadband PEAK 100-200 mbps"),
		makeProduct(3, "Cloud Defenses (DDoS Protection)"),
		makeProduct(4, "On-Premise Defense"),
	];

	const invokeFallback = (
		svc: LangChainService,
		ctx: ConversationContext,
		message: string
	) => {
		// The fallback is private; invoking it directly is the narrowest test
		// of the routing logic without also exercising the Gemini error path.
		return (
			svc as unknown as {
				generateFallbackRecommendations: (
					catalog: CatalogItem[],
					context: ConversationContext,
					msg?: string
				) => { recommendedItems: Array<{ id: number; name: string }>; reply: string };
			}
		).generateFallbackRecommendations(catalog, ctx, message);
	};

	it("routes a fresh security question to security products even when previous turn was about internet", () => {
		const ctx = makeContext({
			// Cached from a prior "I need internet" turn.
			entities: { category: "internet" },
			recentTurns: [
				{
					userMessage: "I need internet for my office",
					botResponse: "Fiber Broadband PEAK ...",
					extractedEntities: {},
					timestamp: new Date(),
				} as ConversationTurnLike,
			],
		});

		const result = invokeFallback(ctx.entities ? service : service, ctx, "What security services do you have?");

		// At least one recommended item must be a security product,
		// and NO fiber product should be recommended.
		expect(result.recommendedItems.length).toBeGreaterThan(0);
		for (const item of result.recommendedItems) {
			expect(item.name.toLowerCase()).not.toContain("fiber");
		}
		const names = result.recommendedItems.map((i) => i.name.toLowerCase()).join(" ");
		expect(names).toMatch(/defense|ddos|security/);
	});

	it("extracts a satellite category for a remote-area hospitality question", () => {
		const ctx = makeContext();
		const result = invokeFallback(service, ctx, "I run a hotel in a remote area");
		// Should at least try to surface Starlink/satellite — with this catalog
		// no satellite product exists, so the fallback should return nothing
		// (or a clarifying reply) rather than defaulting to fiber.
		for (const item of result.recommendedItems) {
			expect(item.name.toLowerCase()).not.toContain("fiber");
		}
	});

	it("returns a clarifying question when the message has no category signal", () => {
		const ctx = makeContext();
		const result = invokeFallback(service, ctx, "I need help");
		// A vague query should ask for clarification, not dump 5 fiber products.
		expect(result.recommendedItems.length).toBe(0);
		expect(result.reply.toLowerCase()).toMatch(
			/what type|looking for|tell me|which solution|internet.*security/
		);
	});
});

// Minimal conversation-turn shape needed by the fallback under test.
type ConversationTurnLike = {
	userMessage: string;
	botResponse: string;
	extractedEntities: Record<string, unknown>;
	timestamp: Date;
};
