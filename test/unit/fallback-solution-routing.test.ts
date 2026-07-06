// test/unit/fallback-solution-routing.test.ts

/**
 * D8: When Gemini is down, the fallback should route a category query to
 * products belonging to the correct SOLUTION, not to a keyword match on the
 * product name. Production has real products like "Cloud Defenses",
 * "SD-WAN Basic", "Starlink Enterprise Kit" whose names don't contain
 * the obvious keywords ("ddos", "vpn", "satellite") — so the keyword filter
 * returns empty and the bot drops to the honest-clarify reply instead of
 * surfacing the correct product.
 *
 * Fix: walk each product's parentId chain up to its solution, and match
 * against the solution name. This matches the actual catalog hierarchy.
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

// Real prod catalog shape — solutions at top, categories under each solution,
// products under each category. parentId threads up the tree.
const catalog: CatalogItem[] = [
	// Solutions
	{ id: 1, name: "Internet", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 2, name: "Transport", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 3, name: "Satellite", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 5, name: "Security Anti-DDos", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 6, name: "Managed Services", description: null, type: "solution", parentId: null, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,

	// Categories
	{ id: 10, name: "Fiber Broadband", description: null, type: "category", parentId: 1, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 20, name: "SD-WAN", description: null, type: "category", parentId: 6, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 30, name: "Starlink", description: null, type: "category", parentId: 3, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 40, name: "Cloud Defenses", description: null, type: "category", parentId: 5, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,

	// Products
	{ id: 100, name: "Fiber Broadband PEAK 50-100 mbps", description: null, type: "product", parentId: 10, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 101, name: "SD-WAN Basic", description: null, type: "product", parentId: 20, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 102, name: "Starlink Enterprise Kit", description: null, type: "product", parentId: 30, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
	{ id: 103, name: "Cloud Defenses Standard", description: null, type: "product", parentId: 40, price: null, contractTerm: null, targetAudienceId: null } as CatalogItem,
];

function makeContext(over: Partial<ConversationContext> = {}): ConversationContext {
	return {
		sessionId: "sid", recentTurns: [], currentRecommendations: [],
		conversationStage: "discovery", userPreferences: {}, ...over,
	} as ConversationContext;
}

const invokeFallback = (
	svc: LangChainService,
	ctx: ConversationContext,
	msg: string
) => (
	svc as unknown as {
		generateFallbackRecommendations: (
			catalog: CatalogItem[],
			context: ConversationContext,
			msg?: string
		) => { recommendedItems: Array<{ id: number; name: string }>; reply: string };
	}
).generateFallbackRecommendations(catalog, ctx, msg);

describe("LangChainService fallback — solution-hierarchy routing", () => {
	let svc: LangChainService;
	beforeEach(() => { svc = new LangChainService(); });

	it("routes a security query to products under the Security Anti-DDos solution", () => {
		const result = invokeFallback(svc, makeContext(), "What security services do you have?");
		const names = result.recommendedItems.map((i) => i.name);
		expect(names).toContain("Cloud Defenses Standard");
		expect(names.some((n) => n.toLowerCase().includes("fiber"))).toBe(false);
	});

	it("routes a satellite / remote-area query to Starlink products", () => {
		const result = invokeFallback(svc, makeContext(), "I need internet in a remote area");
		const names = result.recommendedItems.map((i) => i.name);
		expect(names).toContain("Starlink Enterprise Kit");
		expect(names.some((n) => n.toLowerCase().includes("fiber"))).toBe(false);
	});

	it("routes a transport/VPN/SD-WAN query to the correct solution", () => {
		const result = invokeFallback(svc, makeContext(), "We need SD-WAN for 5 branches");
		const names = result.recommendedItems.map((i) => i.name);
		expect(names).toContain("SD-WAN Basic");
		expect(names.some((n) => n.toLowerCase().includes("fiber"))).toBe(false);
	});

	it("still routes an internet query to Fiber Broadband products", () => {
		const result = invokeFallback(svc, makeContext(), "I need internet for my office");
		const names = result.recommendedItems.map((i) => i.name);
		expect(names).toContain("Fiber Broadband PEAK 50-100 mbps");
	});
});
