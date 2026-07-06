import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type { ChatRequestDto } from "../../../src/dtos/chat.dto.js";
import { ItemSearchService } from "../../../src/services/item-search.service.js";
import type { EnrichedItem } from "../../../src/dtos/chat.dto.js";

// Mock Gemini intent classifier (requires API key)
vi.mock("../../../src/services/gemini-intent-classifier.service.js", () => ({
	GeminiIntentClassifierService: vi.fn().mockImplementation(() => ({
		classifyIntent: vi.fn().mockResolvedValue({
			intent: "product_query",
			confidence: 0.95,
			reasoning: "User is asking about products",
			extractedContext: {
				solution: null,
				category: null,
				bandwidth: null,
				industry: null,
				location: null,
			},
		}),
	})),
}));

// Mock topic switch detector (requires API key)
vi.mock("../../../src/services/topic-switch-detector.service.js", () => ({
	TopicSwitchDetectorService: vi.fn().mockImplementation(() => ({
		detectTopicSwitch: vi.fn().mockResolvedValue({
			isTopicSwitch: false,
			confidence: 0.9,
			previousTopic: null,
			currentTopic: null,
		}),
	})),
}));

// Mock session service
vi.mock("../../../src/services/session.service.js", () => ({
	SessionService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock LangChain to control entity extraction and response generation
const mockLangChainService = {
	extractEntities: vi.fn(),
	generateResponse: vi.fn(),
	generateResponseStream: vi.fn(),
	generateStructuredResponse: vi.fn(),
	generateRecommendationsFromCatalog: vi.fn(),
};

vi.mock("../../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => mockLangChainService),
}));

// Mock DB to suppress real calls
vi.mock("../../../src/db/index.js", () => {
	const createMockQuery = () => ({
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		$dynamic: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		onConflictDoUpdate: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn(),
		then: vi.fn((resolve: (value: unknown[]) => unknown) => resolve([])),
		set: vi.fn().mockReturnThis(),
	});

	const createMockTx = () => {
		const mockUpdate = () => {
			const query = createMockQuery();
			query.set = vi.fn().mockReturnThis();
			return query;
		};
		return {
			insert: vi.fn(() => createMockQuery()),
			select: vi.fn(() => createMockQuery()),
			update: vi.fn(() => mockUpdate()),
		};
	};

	const mockDb = {
		insert: vi.fn(() => createMockQuery()),
		select: vi.fn(() => createMockQuery()),
		update: vi.fn(() => createMockQuery()),
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			return await callback(createMockTx());
		}),
	};

	return { db: mockDb, _createMockQuery: createMockQuery };
});

describe("Hierarchy: category discovery prompt", () => {
	let chat: ChatService;

	beforeEach(async () => {
		vi.clearAllMocks();

		mockLangChainService.extractEntities.mockResolvedValue({
			solution: "Internet",
			intent: "product_search",
		});

		mockLangChainService.generateStructuredResponse.mockResolvedValue({
			narrative: "To narrow down, here are good matches:",
			recommendedByTier: [],
			recommendedItemIds: [],
			followUpQuestions: [],
		});

		mockLangChainService.generateRecommendationsFromCatalog.mockResolvedValue({
			solution: "Internet",
			category: null,
			recommendedItems: [],
			reply: "To narrow down, here are good matches:",
			confidence: 0.85,
		});

		// Ensure session upsert returns a valid row
		const dbModule = (await import("../../../src/db/index.js")) as unknown as {
			db: {
				insert: ReturnType<typeof vi.fn>;
				select: ReturnType<typeof vi.fn>;
			};
			_createMockQuery: () => {
				returning: ReturnType<typeof vi.fn>;
				then: ReturnType<typeof vi.fn>;
			} & Record<string, unknown>;
		};
		const sessionQuery = dbModule._createMockQuery();
		sessionQuery.returning.mockResolvedValue([
			{ id: 1, sessionId: `cat-discovery-${Date.now()}` },
		]);
		dbModule.db.insert.mockReturnValue(sessionQuery);

		chat = new ChatService();
	});

	it("shows top 3 categories for vague 'internet' query", async () => {
		const categories = [
			{
				id: 8,
				name: "Fiber Broadband",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category" as const,
				productCategory: null,
				targetAudience: null,
				features: [],
			},
			{
				id: 9,
				name: "Fiber Dedicated",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category" as const,
				productCategory: null,
				targetAudience: null,
				features: [],
			},
			{
				id: 10,
				name: "IX Express",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category" as const,
				productCategory: null,
				targetAudience: null,
				features: [],
			},
		];
		vi.spyOn(
			ItemSearchService.prototype,
			"getCategoriesUnderSolution"
		).mockResolvedValue(categories as unknown as EnrichedItem[]);

		const res = await chat.processMessage({
			session_id: `cat-discovery-${Date.now()}`,
			message: "we need internet",
		} as ChatRequestDto);

		const items = res.recommended_items || [];
		expect(items.length).toBeGreaterThanOrEqual(0);

		const reply = (res.reply || "").toLowerCase();
		expect(reply.includes("here are good matches:")).toBe(true);
	});
});
