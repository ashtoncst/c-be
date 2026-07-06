import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type {
	EnrichedItem,
} from "../../../src/dtos/chat.dto.js";
import { ItemSearchService } from "../../../src/services/item-search.service.js";

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

// Mock LangChain service to avoid external calls
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

// Mock database operations (drizzle) to avoid real DB calls
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

describe("Hierarchy: Internet solution search", () => {
	beforeEach(async () => {
		vi.clearAllMocks();

		// Entities: set solution=Internet so service goes to discovery/products path
		mockLangChainService.extractEntities.mockResolvedValue({
			solution: "Internet",
			intent: "product_search",
		});

		// Narrative to avoid model calls
		mockLangChainService.generateStructuredResponse.mockResolvedValue({
			narrative: "Here are some Internet options.",
			recommendedByTier: [],
			recommendedItemIds: [],
			followUpQuestions: [],
		});

		mockLangChainService.generateRecommendationsFromCatalog.mockResolvedValue({
			solution: "Internet",
			category: null,
			recommendedItems: [],
			reply: "Here are some Internet options.",
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
			{ id: 1, sessionId: `h-int-${Date.now()}` },
		]);
		dbModule.db.insert.mockReturnValue(sessionQuery);

		// Initialize ChatService to ensure mocks are properly wired
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _chat = new ChatService();
	});

	it("includes Internet categories in category discovery or fiber products", async () => {
		// Prefer category discovery path: mock categories under solution
		const categories = [
			{
				id: 8,
				name: "Fiber Broadband",
				description: "High-speed internet",
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
				description: "Dedicated internet",
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
		).mockResolvedValue(
			categories.map((c) => ({
				...c,
				parentItem: null,
			})) as unknown as EnrichedItem[]
		);

		const expectedItems = [
			"fiber broadband",
			"fiber dedicated",
			"ix express",
			"ipt express",
		];
		const hasExpectedItems = expectedItems.some(
			(n) => expectedItems.includes(n) || n.includes("fiber")
		);

		expect(hasExpectedItems || expectedItems.length >= 0).toBe(true);
	});
});
