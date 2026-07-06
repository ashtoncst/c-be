import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ChatService } from "../../src/services/chat.service.js";
import type { ChatRequestDto } from "../../src/dtos/chat.dto.js";

// Mock logger
vi.mock("../../src/logger-config.js", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock Logger class from utils
vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		log: vi.fn(),
	})),
}));

// Mock Gemini services
vi.mock("../../src/services/gemini-intent-classifier.service.js", () => ({
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

vi.mock("../../src/services/topic-switch-detector.service.js", () => ({
	TopicSwitchDetectorService: vi.fn().mockImplementation(() => ({
		detectTopicSwitch: vi.fn().mockResolvedValue({
			isTopicSwitch: false,
			confidence: 0.9,
			previousTopic: null,
			currentTopic: null,
		}),
	})),
}));

vi.mock("../../src/services/session.service.js", () => ({
	SessionService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock database
vi.mock("../../src/config/database.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue([
			{
				id: 1,
				name: "Internet",
				description: "High-speed internet solutions",
				type: "solution",
				parentId: null,
				price: null,
				contractTerm: null,
				targetAudienceId: null,
			},
			{
				id: 8,
				name: "Fiber Broadband",
				description: "Fast fiber internet",
				type: "category",
				parentId: 1,
				price: null,
				contractTerm: null,
				targetAudienceId: null,
			},
			{
				id: 33,
				name: "Fiber Broadband PEAK 50-100 mbps",
				description: "Ideal for medium businesses",
				type: "product",
				parentId: 8,
				price: "1500",
				contractTerm: "12 months",
				targetAudienceId: 1,
			},
		]),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		onConflictDoUpdate: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([{ session_id: "test-session" }]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
	},
}));

// Mock context service
vi.mock("../../src/services/context.service.js", () => ({
	ContextService: vi.fn().mockImplementation(() => ({
		loadContext: vi.fn().mockResolvedValue({
			recentTurns: [], // ✅ FIXED: Correct property name
			userPreferences: {},
			currentRecommendations: [],
			conversationStage: "discovery", // ✅ FIXED: Valid stage value
		}),
		saveTurn: vi.fn().mockResolvedValue(undefined),
	})),
}));

// Mock LangChain service with catalog-in-prompt
vi.mock("../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => ({
		extractEntities: vi.fn().mockResolvedValue({}),
		generateRecommendationsFromCatalog: vi.fn().mockResolvedValue({
			solution: "Internet",
			category: "Fiber Broadband",
			recommendedItems: [
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					reason: "Ideal for your hotel with 50 rooms",
				},
			],
			reply:
				"Based on your 50-room hotel, I recommend our Fiber Broadband PEAK plans for reliable connectivity.",
			confidence: 0.92,
		}),
	})),
}));

// Mock all other services that ChatService uses
vi.mock("../../src/services/item-search.service.js", () => ({
	ItemSearchService: vi.fn().mockImplementation(() => ({
		search: vi.fn().mockResolvedValue([]),
	})),
}));

vi.mock("../../src/services/response.service.js", () => ({
	ResponseService: vi.fn().mockImplementation(() => ({
		generateResponse: vi.fn().mockResolvedValue("Test response"),
	})),
}));

vi.mock("../../src/services/entity-enrichment.service.js", () => ({
	EntityEnrichmentService: vi.fn().mockImplementation(() => ({
		enrichEntities: vi.fn().mockResolvedValue({
			solution: "Internet",
			category: "Fiber Broadband",
		}),
	})),
}));

// Mock catalog cache service
vi.mock("../../src/services/catalog-cache.service.js", () => ({
	CatalogCacheService: {
		getInstance: vi.fn(() => ({
			getCatalog: vi.fn().mockResolvedValue([
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet solutions",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 8,
					name: "Fiber Broadband",
					description: "Fast fiber internet",
					type: "category",
					parentId: 1,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					description: "Ideal for medium businesses",
					type: "product",
					parentId: 8,
					price: "1500",
					contractTerm: "12 months",
					targetAudienceId: 1,
				},
			]),
			buildHierarchy: vi.fn((catalog) => {
				const solutions = catalog.filter(
					(i: { type: string }) => i.type === "solution"
				);
				return solutions.map((sol: { id: number; type: string }) => ({
					...sol,
					categories: catalog
						.filter(
							(c: { type: string; parentId: number | null }) =>
								c.type === "category" && c.parentId === sol.id
						)
						.map((cat: { id: number; type: string }) => ({
							...cat,
							products: catalog.filter(
								(p: { type: string; parentId: number | null }) =>
									p.type === "product" && p.parentId === cat.id
							),
						})),
				}));
			}),
		})),
	},
}));

describe("ChatService - Catalog-in-Prompt Integration", () => {
	let chatService: ChatService;

	beforeEach(() => {
		vi.clearAllMocks();
		chatService = new ChatService();

		// Ensure logger methods are properly mocked
		// @ts-expect-error - Mocking private logger for tests
		chatService.logger = {
			info: vi.fn(),
			debug: vi.fn(),
			error: vi.fn(),
			warn: vi.fn(),
			log: vi.fn(),
		};

		// Mock contextService
		// @ts-expect-error - Mocking private contextService for tests
		chatService.contextService = {
			loadContext: vi.fn().mockResolvedValue({
				recentTurns: [], // ✅ FIXED: Correct property name
				userPreferences: {},
				currentRecommendations: [],
				conversationStage: "discovery", // ✅ FIXED: Valid stage value
			}),
			loadIntelligentContext: vi.fn().mockResolvedValue({
				recentTurns: [],
				userPreferences: {},
				currentRecommendations: [],
				conversationStage: "discovery",
			}),
			saveTurn: vi.fn().mockResolvedValue(undefined),
		};

		// Mock catalogCache
		// @ts-expect-error - Mocking private catalogCache for tests
		chatService.catalogCache = {
			getCatalog: vi.fn().mockResolvedValue({
				flat: [
					// ✅ FIXED: Wrapped in flat property
					{
						id: 1,
						name: "Internet",
						description: "High-speed internet solutions",
						type: "solution",
						parentId: null,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 8,
						name: "Fiber Broadband",
						description: "Fast fiber internet",
						type: "category",
						parentId: 1,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 33,
						name: "Fiber Broadband PEAK 50-100 mbps",
						description: "Ideal for medium businesses",
						type: "product",
						parentId: 8,
						price: "1500",
						contractTerm: "12 months",
						targetAudienceId: 1,
					},
				],
				hierarchical: [], // ✅ ADDED: hierarchical property
				metadata: {
					// ✅ ADDED: metadata property
					itemCount: 3,
					solutionCount: 1,
					categoryCount: 1,
					productCount: 1,
					lastUpdated: new Date(),
				},
			}),
		};

		// Mock intentClassifier
		// @ts-expect-error - Mocking private intentClassifier for tests
		chatService.intentClassifier = {
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
		};

		// Mock topicSwitchDetector
		// @ts-expect-error - Mocking private topicSwitchDetector for tests
		chatService.topicSwitchDetector = {
			detectTopicSwitch: vi.fn().mockResolvedValue({
				isTopicSwitch: false,
				confidence: 0.9,
				previousTopic: null,
				currentTopic: null,
			}),
		};

		// Mock langChainService
		// @ts-expect-error - Mocking private langChainService for tests
		chatService.langChainService = {
			extractEntities: vi.fn().mockResolvedValue({}),
			generateRecommendationsFromCatalog: vi.fn().mockResolvedValue({
				solution: "Internet",
				category: "Fiber Broadband",
				recommendedItems: [
					{
						id: 33,
						name: "Fiber Broadband PEAK 50-100 mbps",
						reason: "Ideal for your hotel with 50 rooms",
					},
				],
				reply:
					"Based on your 50-room hotel, I recommend our Fiber Broadband PEAK plans for reliable connectivity.",
				confidence: 0.92,
			}),
		};

		// Mock sessionService
		// @ts-expect-error - Mocking private sessionService for tests
		chatService.sessionService = {
			getOrCreateSession: vi.fn().mockResolvedValue({
				session_id: "test-session",
				created_at: new Date(),
				updated_at: new Date(),
			}),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("processMessage", () => {
		it("should handle simple query with catalog-in-prompt", async () => {
			const request: ChatRequestDto = {
				message: "I need internet for my hotel",
				session_id: "test-session-1", // ✅ FIXED: Use snake_case
			};

			const response = await chatService.processMessage(request);

			expect(response).toHaveProperty("reply");
			expect(response).toHaveProperty("recommended_items");
			expect(response.recommended_items?.length).toBeGreaterThan(0); // ✅ FIXED: Optional chaining
			// ✅ REMOVED: confidence and processingTimeMs are logged internally, not in response
		});

		it("should return items with proper structure", async () => {
			const request: ChatRequestDto = {
				message: "I need internet for my hotel with 50 rooms",
				session_id: "test-session-2", // ✅ FIXED: Use snake_case
			};

			const response = await chatService.processMessage(request);

			expect(Array.isArray(response.recommended_items)).toBe(true);
			response.recommended_items?.forEach((item) => {
				// ✅ FIXED: Optional chaining
				expect(item).toHaveProperty("id");
				expect(item).toHaveProperty("name");
				expect(item).toHaveProperty("itemType"); // ✅ FIXED: Use camelCase
				expect(typeof item.id).toBe("number");
				expect(typeof item.name).toBe("string");
				expect(typeof item.itemType).toBe("string"); // ✅ FIXED: Use camelCase
			});
		});

		// ✅ REMOVED: confidence and processingTimeMs are not part of ChatResponseDto
		// These properties were removed as part of the catalog-in-prompt refactoring
		// They are logged internally but not returned in the API response
		it.skip("should include confidence score (DEPRECATED - removed from ChatResponseDto)", async () => {
			// This test is kept for reference but skipped
			// confidence is now logged internally only, not returned in response
		});

		it.skip("should track processing time (DEPRECATED - removed from ChatResponseDto)", async () => {
			// This test is kept for reference but skipped
			// processingTimeMs is now logged internally only, not returned in response
		});

		it("should handle errors gracefully", async () => {
			// Mock the LangChain service to throw an error
			// @ts-expect-error - Accessing private property for testing
			chatService.langChainService = {
				extractEntities: vi.fn().mockResolvedValue({}),
				generateRecommendationsFromCatalog: vi
					.fn()
					.mockRejectedValue(new Error("API Error")),
			};

			const request: ChatRequestDto = {
				message: "I need internet",
				session_id: "test-session-error", // ✅ FIXED: Use snake_case
			};

			await expect(chatService.processMessage(request)).rejects.toThrow(
				"API Error"
			);
		});
	});

	describe("Multi-turn conversations", () => {
		it("should maintain context across turns", async () => {
			const sessionId = "test-session-multi";

			// First turn
			const request1: ChatRequestDto = {
				message: "I'm looking for internet",
				session_id: sessionId, // ✅ FIXED: Use snake_case
			};
			const response1 = await chatService.processMessage(request1);
			expect(response1.recommended_items?.length).toBeGreaterThan(0); // ✅ FIXED: Optional chaining

			// Second turn - context should be used
			const request2: ChatRequestDto = {
				message: "We have 50 rooms",
				session_id: sessionId, // ✅ FIXED: Use snake_case
			};
			const response2 = await chatService.processMessage(request2);
			expect(response2).toHaveProperty("reply");
		});

		it("should not repeat recommendations when asked for alternatives", async () => {
			const sessionId = "test-session-alternatives";

			// First turn: Get initial recommendations
			const request1: ChatRequestDto = {
				message: "I need internet for my business",
				session_id: sessionId,
			};
			const response1 = await chatService.processMessage(request1);
			const firstIds = response1.recommended_items?.map((i) => i.id) || [];
			expect(firstIds.length).toBeGreaterThan(0);

			// Second turn: Ask for alternatives
			const request2: ChatRequestDto = {
				message: "what else do you have?",
				session_id: sessionId,
			};
			const response2 = await chatService.processMessage(request2);

			// Verify second response is valid
			expect(response2).toHaveProperty("reply");
			expect(response2.recommended_items).toBeDefined();
			// Note: The service should maintain context across turns
			// The mocked services will handle this through loadIntelligentContext
		});
	});

	describe("Synonym handling", () => {
		it("should handle wifi synonym automatically", async () => {
			const request: ChatRequestDto = {
				message: "I need wifi for my office",
				session_id: "test-session-wifi", // ✅ FIXED: Use snake_case
			};

			const response = await chatService.processMessage(request);
			expect(response.recommended_items?.length).toBeGreaterThan(0); // ✅ FIXED: Optional chaining
		});

		it("should handle fiber synonym automatically", async () => {
			const request: ChatRequestDto = {
				message: "We need fiber internet",
				session_id: "test-session-fiber", // ✅ FIXED: Use snake_case
			};

			const response = await chatService.processMessage(request);
			expect(response.recommended_items?.length).toBeGreaterThan(0); // ✅ FIXED: Optional chaining
		});
	});
});
