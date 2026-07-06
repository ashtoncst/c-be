import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type {
	ChatRequestDto,
	EnrichedItem,
} from "../../../src/dtos/chat.dto.js";
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

describe("Anomalies: catalog resilience", () => {
	let chat: ChatService;

	beforeEach(async () => {
		vi.clearAllMocks();

		mockLangChainService.extractEntities.mockResolvedValue({});
		mockLangChainService.generateStructuredResponse.mockResolvedValue({
			narrative: "Response",
		});

		mockLangChainService.generateRecommendationsFromCatalog.mockResolvedValue({
			solution: "Internet",
			category: null,
			recommendedItems: [
				{
					id: 49,
					name: "Starlink Enterprise Kit",
					reason: "Satellite connectivity",
				},
			],
			reply: "Here are some options.",
			confidence: 0.85,
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
			{ id: 1, sessionId: `an-${Date.now()}` },
		]);
		dbModule.db.insert.mockReturnValue(sessionQuery);

		chat = new ChatService();
	});

	it("Satellite query includes Starlink kits (solution-parented products)", async () => {
		// Force union to include Starlink
		vi.spyOn(ItemSearchService.prototype, "searchByEntities").mockResolvedValue(
			[
				{
					id: 49,
					name: "Starlink Enterprise Kit",
					description: "",
					price: null,
					contractTerm: null,
					itemType: "product",
					parentItem: null,
					targetAudience: null,
					features: [],
				},
			]
		);

		const res = await chat.processMessage({
			session_id: `sat-${Date.now()}`,
			message: "starlink fixed site",
		} as ChatRequestDto);

		const names = (res.recommended_items || []).map((p) =>
			p.name.toLowerCase()
		);
		expect(names.some((n) => n.includes("starlink"))).toBe(true);
	});

	it("Transport vpn intent does not surface Content items mislinked to Transport", async () => {
		// Mock transport results to contain only transport-appropriate items
		vi
			.spyOn(ItemSearchService.prototype, "searchByEntities")
			.mockResolvedValue([
				{
					id: 13001,
					name: "IP VPN",
					description: "",
					price: null,
					contractTerm: null,
					itemType: "product",
					parentItem: {
						id: 13,
						name: "IP VPN",
						description: "",
					} as EnrichedItem,
					targetAudience: null,
					features: [],
				},
			] as EnrichedItem[]) as unknown as EnrichedItem[];

		const res = await chat.processMessage({
			session_id: `wan-${Date.now()}`,
			message: "Need WAN between branches",
		} as ChatRequestDto);

		const names = (res.recommended_items || []).map((p) =>
			p.name.toLowerCase()
		);
		const forbidden = [
			"stb with app",
			"smart tv with app",
			"app only",
			"hotel x package",
			"add ons",
		];
		expect(names.some((n) => forbidden.some((f) => n.includes(f)))).toBe(false);
	});
});
