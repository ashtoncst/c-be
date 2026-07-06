// test/unit/fallback-comparison.test.ts

/**
 * D5: "What's the difference between X and Y?" is a comparison intent.
 * Production fallback treats it as an ordinary product query, filters the
 * catalog by category, and returns an SKU list — not a comparison. When
 * Gemini is down the bot can't generate a rich comparison but it can at
 * least surface BOTH named products with their descriptions side-by-side
 * so the user has something useful to work with.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CatalogItem } from "../../src/types/catalog.types.js";
import type { ConversationContext } from "../../src/dtos/chat.dto.js";

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
	{ id: 11, name: "Fiber Dedicated", description: null, type: "category", parentId: 1, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 100, name: "Fiber Broadband PEAK 50-100 mbps", description: "Shared fiber uplink, best-effort peak performance, 50-100 mbps", type: "product", parentId: 10, price: "3500", contractTerm: "24 months", targetAudienceId: null } as CatalogItem,
	{ id: 200, name: "Fiber Dedicated DIA 100 mbps", description: "Dedicated Internet Access, 1:1 uncontended, 100 mbps symmetric", type: "product", parentId: 11, price: "15000", contractTerm: "36 months", targetAudienceId: null } as CatalogItem,
];

function makeContext(over: Partial<ConversationContext> = {}): ConversationContext {
	return {
		sessionId: "sid", recentTurns: [], currentRecommendations: [],
		conversationStage: "discovery", userPreferences: {}, ...over,
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

describe("LangChainService fallback — comparison intent", () => {
	let svc: LangChainService;
	beforeEach(() => { svc = new LangChainService(); });

	it("surfaces BOTH named products when user asks for a difference", () => {
		const result = invokeFallback(
			svc,
			makeContext(),
			"What's the difference between Fiber Broadband and Fiber Dedicated?"
		);
		const names = result.recommendedItems.map((i) => i.name);
		// At least one product from each of the two mentioned categories.
		expect(names.some((n) => n.includes("Fiber Broadband"))).toBe(true);
		expect(names.some((n) => n.includes("Fiber Dedicated"))).toBe(true);
	});

	it("uses a comparison-shaped reply (not a generic SKU dump)", () => {
		const result = invokeFallback(
			svc,
			makeContext(),
			"Compare Fiber Broadband vs Fiber Dedicated"
		);
		// Reply should flag it's a comparison — not the "worth looking at" template.
		expect(result.reply.toLowerCase()).toMatch(
			/compar|difference|vs\.?|versus|side-by-side/
		);
		expect(result.reply).not.toMatch(/worth looking at/);
	});

	it("keeps normal product-query behavior when no comparison keyword is present", () => {
		const result = invokeFallback(svc, makeContext(), "I need internet");
		expect(result.reply).not.toMatch(/compar|difference|versus|vs\./i);
	});

	it("still emits a comparison when one mentioned category has no products (shell category)", () => {
		// Prod catalog has "Fiber Dedicated" as a category with ZERO products
		// (only Fiber Broadband products exist). The comparison branch must
		// still emit a side-by-side reply using the category description
		// rather than fall through to the generic SKU template.
		const catalogWithShell: CatalogItem[] = [
			{ id: 1, name: "Internet", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
			{ id: 10, name: "Fiber Broadband", description: null, type: "category", parentId: 1, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
			{ id: 11, name: "Fiber Dedicated", description: "Dedicated 1:1 uncontended fiber line", type: "category", parentId: 1, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
			{ id: 100, name: "Fiber Broadband PEAK 50-100 mbps", description: "Shared fiber uplink", type: "product", parentId: 10, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
		];
		const result = (svc as unknown as {
			generateFallbackRecommendations: (
				catalog: CatalogItem[],
				context: ConversationContext,
				msg?: string
			) => { recommendedItems: Array<{ id: number; name: string }>; reply: string };
		}).generateFallbackRecommendations(
			catalogWithShell,
			makeContext(),
			"What's the difference between Fiber Broadband and Fiber Dedicated?"
		);
		// Reply should be a comparison and mention BOTH category labels.
		expect(result.reply.toLowerCase()).toContain("comparison");
		expect(result.reply).toContain("Fiber Broadband");
		expect(result.reply).toContain("Fiber Dedicated");
		expect(result.reply).not.toMatch(/worth looking at/);
	});
});
