import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type { ChatRequestDto } from "../../../src/dtos/chat.dto.js";
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

// Mock LangChain to avoid external API and let inference handle mapping
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

describe("Guardrails: Security Anti-DDos anchoring", () => {
	let chat: ChatService;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Let extractor return minimal so inference maps from message
		mockLangChainService.extractEntities.mockResolvedValue({});
		mockLangChainService.generateStructuredResponse.mockResolvedValue({
			narrative: "Security options",
			recommendedByTier: [],
			recommendedItemIds: [],
			followUpQuestions: [],
		});

		mockLangChainService.generateRecommendationsFromCatalog.mockResolvedValue({
			solution: "Security Anti-DDos",
			category: "On-Premise Defense",
			recommendedItems: [
				{
					id: 999,
					name: "DDoS On-Prem Defense",
					reason: "On-premise security",
				},
			],
			reply: "Here are security options for DDoS protection.",
			confidence: 0.9,
		});

		// Mock session upsert
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
			{ id: 1, sessionId: `sec-ddos-${Date.now()}` },
		]);
		dbModule.db.insert.mockReturnValue(sessionQuery);

		// Provide security categories when discovery kicks in
		vi.spyOn(
			ItemSearchService.prototype,
			"getCategoriesUnderSolution"
		).mockResolvedValue([
			{
				id: 26,
				name: "On-Premise Defense",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category",
				parentItem: null,
				targetAudience: null,
				features: [],
			},
			{
				id: 27,
				name: "Hybrid Defenses",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category",
				parentItem: null,
				targetAudience: null,
				features: [],
			},
			{
				id: 28,
				name: "Cloud Defenses",
				description: "",
				price: null,
				contractTerm: null,
				itemType: "category",
				parentItem: null,
				targetAudience: null,
				features: [],
			},
		]);

		// Also ensure any product search does not return fiber broadband
		vi.spyOn(ItemSearchService.prototype, "searchByEntities").mockResolvedValue(
			[
				{
					id: 999,
					name: "DDoS On-Prem Defense",
					description: "",
					price: null,
					contractTerm: null,
					itemType: "product",
					parentItem: {
						id: 26,
						name: "On-Premise Defense",
						description: "",
					},
					targetAudience: null,
					features: [],
				},
			]
		);

		chat = new ChatService();
	});

	it("never returns Fiber Broadband for ddos intent and shows security alignment", async () => {
		const res = await chat.processMessage({
			session_id: `sec-ddos-${Date.now()}`,
			message: "on-premise ddos defense",
		} as ChatRequestDto);

		const prodNames = (res.recommended_items || []).map((p) =>
			p.name.toLowerCase()
		);
		const catNames = (res.recommended_items || []).map((c) =>
			c.name.toLowerCase()
		);

		expect(prodNames.some((n) => n.includes("fiber broadband"))).toBe(false);
		const hasSecurity =
			prodNames.some((n) =>
				["defense", "ddos", "security"].some((k) => n.includes(k))
			) ||
			catNames.some((n) =>
				["on-premise defense", "hybrid defenses", "cloud defenses"].includes(n)
			);
		expect(hasSecurity).toBe(true);
	});
});
