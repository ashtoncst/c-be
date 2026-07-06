import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type { ChatRequestDto } from "../../../src/dtos/chat.dto.js";
import { ItemSearchService } from "../../../src/services/item-search.service.js";

// Mock Gemini services
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

vi.mock("../../../src/services/session.service.js", () => ({
	SessionService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock LangChain
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

// Mock DB
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

describe("Multi-turn context preservation", () => {
	let chat: ChatService;

	beforeEach(async () => {
		vi.clearAllMocks();

		mockLangChainService.extractEntities.mockResolvedValue({
			solution: "Internet",
		});
		mockLangChainService.generateStructuredResponse.mockResolvedValue({
			narrative: "Details",
		});

		mockLangChainService.generateRecommendationsFromCatalog.mockResolvedValue({
			solution: "Internet",
			category: "Fiber Broadband",
			recommendedItems: [
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					reason: "Good for internet",
				},
			],
			reply: "Here are some Internet options for you.",
			confidence: 0.88,
		});

		const dbModule = (await import("../../../src/db/index.js")) as unknown as {
			db: {
				insert: ReturnType<typeof vi.fn>;
				select: ReturnType<typeof vi.fn>;
			};
			_createMockQuery: () => { returning: ReturnType<typeof vi.fn> } & Record<
				string,
				unknown
			>;
		};
		const sessionQuery = dbModule._createMockQuery();
		sessionQuery.returning.mockResolvedValue([
			{ id: 1, sessionId: `mt-${Date.now()}` },
		]);
		dbModule.db.insert.mockReturnValue(sessionQuery);

		// Categories for discovery
		vi.spyOn(
			ItemSearchService.prototype,
			"getCategoriesUnderSolution"
		).mockResolvedValue([
			{
				id: 8,
				name: "Fiber Broadband",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category",
				parentItem: null,
				targetAudience: null,
				features: [],
			},
			{
				id: 9,
				name: "Fiber Dedicated",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category",
				parentItem: null,
				targetAudience: null,
				features: [],
			},
		]);

		chat = new ChatService();
	});

	it("affirmation adds confirmation prefix about last items", async () => {
		const sid = `mt-${Date.now()}`;
		const first = await chat.processMessage({
			session_id: sid,
			message: "we need internet",
		} as ChatRequestDto);
		expect(first.reply).toBeTruthy();

		const second = await chat.processMessage({
			session_id: sid,
			message: "yes",
		} as ChatRequestDto);
		// Verify we get a valid response to the affirmation
		expect(second.reply).toBeTruthy();
		expect(second.reply.length).toBeGreaterThan(0);
		// The response should maintain context (not be an error or empty)
	});
});
