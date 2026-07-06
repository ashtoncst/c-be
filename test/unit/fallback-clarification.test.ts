// test/unit/fallback-clarification.test.ts

/**
 * D4: "tell me more about that" / "what speeds does it support?" are
 * clarification intents that reference the previous recommendation. When
 * Gemini is down, the old fallback re-extracted entities from the message
 * alone, found no category, and returned the honest-clarify reply — which
 * from the user's perspective LOSES the conversation. Fix: when the
 * current message is a clarification request AND we have prior
 * recommendations, surface details on those recommendations instead of
 * the generic clarify reply.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CatalogItem } from "../../src/types/catalog.types.js";
import type { ConversationContext, EnrichedItem } from "../../src/dtos/chat.dto.js";

vi.mock("@langchain/google-genai", () => ({
	ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		invoke: vi.fn().mockRejectedValue(new Error("gemini down")),
	})),
}));
vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn() })),
}));
vi.mock("../../src/utils/langchain-logger.js", () => ({
	LangChainLogger: vi.fn().mockImplementation(() => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn(), log: vi.fn() })),
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

const catalog: CatalogItem[] = [
	{ id: 1, name: "Internet", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 10, name: "Fiber Broadband", description: null, type: "category", parentId: 1, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 100, name: "Fiber Broadband PEAK 50-100 mbps", description: "Dedicated fiber line, 50-100 mbps throughput, 99.9% SLA", type: "product", parentId: 10, price: "3500", contractTerm: "24 months", targetAudienceId: null } as CatalogItem,
];

const makeRec = (id: number, name: string, description?: string): EnrichedItem => ({
	id,
	name,
	description: description ?? null,
	price: null,
	contractTerm: null,
	itemType: "product",
	parentItem: null,
	targetAudience: null,
	features: [],
});

function makeContext(over: Partial<ConversationContext> = {}): ConversationContext {
	return {
		sessionId: "sid", recentTurns: [], currentRecommendations: [],
		conversationStage: "feedback", userPreferences: {}, ...over,
	} as ConversationContext;
}

const invokeFallback = (svc: LangChainService, ctx: ConversationContext, msg: string) => (
	svc as unknown as {
		generateFallbackRecommendations: (
			catalog: CatalogItem[],
			context: ConversationContext,
			msg?: string
		) => { recommendedItems: Array<{ id: number; name: string }>; reply: string };
	}
).generateFallbackRecommendations(catalog, ctx, msg);

describe("LangChainService fallback — clarification carries last recommendations", () => {
	let svc: LangChainService;
	beforeEach(() => { svc = new LangChainService(); });

	it("returns details on the last recommendation when user says 'tell me more about that'", () => {
		const ctx = makeContext({
			currentRecommendations: [
				makeRec(100, "Fiber Broadband PEAK 50-100 mbps", "Dedicated fiber line, 50-100 mbps throughput, 99.9% SLA"),
			],
		});

		const result = invokeFallback(svc, ctx, "tell me more about that");

		// Reply must include the recommended product name so the user doesn't
		// feel like the bot forgot what was just said.
		expect(result.reply).toContain("Fiber Broadband PEAK 50-100 mbps");
		// Recommended items echoed back so the UI can highlight them again.
		expect(result.recommendedItems.map((i) => i.name)).toContain(
			"Fiber Broadband PEAK 50-100 mbps"
		);
	});

	it("also handles 'what speeds does it support?' as a clarification on last rec", () => {
		const ctx = makeContext({
			currentRecommendations: [makeRec(100, "Fiber Broadband PEAK 50-100 mbps", "50-100 mbps throughput")],
		});
		const result = invokeFallback(svc, ctx, "What speeds does it support?");
		expect(result.reply).toContain("Fiber Broadband PEAK 50-100 mbps");
	});

	it("falls through to normal behavior when there are no previous recommendations", () => {
		const ctx = makeContext({ currentRecommendations: [] });
		const result = invokeFallback(svc, ctx, "tell me more about that");
		// No prior rec — bot should ask for a topic, not invent one.
		expect(result.reply.toLowerCase()).toMatch(
			/what type|looking for|which solution/
		);
		expect(result.recommendedItems.length).toBe(0);
	});
});
