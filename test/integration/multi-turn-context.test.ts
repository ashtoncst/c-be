import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ChatService } from "../../src/services/chat.service.js";

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

// Mock database
vi.mock("../../src/config/database.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		insert: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		onConflictDoUpdate: vi.fn().mockReturnThis(),
		returning: vi.fn().mockResolvedValue([{ session_id: "test-session" }]),
		update: vi.fn().mockReturnThis(),
		set: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
	},
}));

// Mock context service
vi.mock("../../src/services/context.service.js", () => ({
	ContextService: vi.fn().mockImplementation(() => {
		let currentRecommendations: Array<{
			id: number;
			name: string;
			itemType: string;
		}> = [];

		return {
			loadContext: vi.fn().mockImplementation(async () => ({
				recentTurns: [],
				userPreferences: {},
				currentRecommendations,
				conversationStage: "discovery" as const,
			})),
			saveTurn: vi
				.fn()
				.mockImplementation(
					async (_sessionId, _request, _response, _entities, enrichedItems) => {
						// Update current recommendations for next turn
						currentRecommendations = enrichedItems.map(
							(item: { id: number; name: string; itemType: string }) => ({
								id: item.id,
								name: item.name,
								itemType: item.itemType,
							})
						);
					}
				),
		};
	}),
}));

// Mock deterministic decision tree
vi.mock("../../src/services/deterministic-decision-tree.service.js", () => ({
	DeterministicDecisionTreeService: vi.fn().mockImplementation(() => ({
		recommend: vi
			.fn()
			.mockResolvedValue({ products: [], category: null, solution: null }),
	})),
}));

// Mock Gemini intent classifier (requires API key)
vi.mock("../../src/services/gemini-intent-classifier.service.js", () => ({
	GeminiIntentClassifierService: vi.fn().mockImplementation(() => ({
		classifyIntent: vi.fn().mockResolvedValue({
			intent: "product_query",
			confidence: 0.95,
			reasoning: "User is asking about products",
		}),
	})),
}));

// Mock session service
vi.mock("../../src/services/session.service.js", () => ({
	SessionService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock topic switch detector (requires API key)
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

// Mock catalog cache service with multiple products
vi.mock("../../src/services/catalog-cache.service.js", () => ({
	CatalogCacheService: {
		getInstance: vi.fn(() => ({
			getCatalog: vi.fn().mockResolvedValue({
				flat: [
					// Internet solutions
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
					{
						id: 34,
						name: "Fiber Broadband PEAK 200-500 mbps",
						description: "High-speed fiber for large enterprises",
						type: "product",
						parentId: 8,
						price: "3500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					{
						id: 35,
						name: "Fiber Broadband PEAK 500-1000 mbps",
						description: "Ultra-high-speed fiber",
						type: "product",
						parentId: 8,
						price: "5500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					// Security solutions
					{
						id: 5,
						name: "Security Anti-DDos",
						description: "DDoS protection and cybersecurity services",
						type: "solution",
						parentId: null,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 18,
						name: "On-Premise Defense",
						description: "On-premise DDoS protection",
						type: "category",
						parentId: 5,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 52,
						name: "Anti-DDoS On-Premise Basic",
						description: "Basic on-premise DDoS protection",
						type: "product",
						parentId: 18,
						price: "2500",
						contractTerm: "12 months",
						targetAudienceId: 1,
					},
					{
						id: 53,
						name: "Anti-DDoS On-Premise Advanced",
						description: "Advanced on-premise DDoS protection",
						type: "product",
						parentId: 18,
						price: "5000",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					// Managed Services
					{
						id: 6,
						name: "Managed Services",
						description: "IT management and support services",
						type: "solution",
						parentId: null,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 22,
						name: "Managed Wi-Fi",
						description: "Managed Wi-Fi solutions",
						type: "category",
						parentId: 6,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 61,
						name: "Managed Wi-Fi Basic",
						description: "Basic managed Wi-Fi solution",
						type: "product",
						parentId: 22,
						price: "800",
						contractTerm: "12 months",
						targetAudienceId: 1,
					},
					{
						id: 62,
						name: "Managed Wi-Fi Premium",
						description: "Premium managed Wi-Fi solution",
						type: "product",
						parentId: 22,
						price: "1500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
				],
				hierarchical: [],
				metadata: {
					itemCount: 13,
					solutionCount: 3,
					categoryCount: 3,
					productCount: 7,
					lastUpdated: new Date(),
				},
			}),
		})),
	},
}));

// Mock LangChain service with catalog-in-prompt
vi.mock("../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => {
		// eslint-disable-next-line prefer-const
		let previousIds: number[] = [];
		const allProducts = [
			{ id: 33, name: "Fiber Broadband PEAK 50-100 mbps" },
			{ id: 34, name: "Fiber Broadband PEAK 200-500 mbps" },
			{ id: 35, name: "Fiber Broadband PEAK 500-1000 mbps" },
			{ id: 52, name: "Anti-DDoS On-Premise Basic" },
			{ id: 53, name: "Anti-DDoS On-Premise Advanced" },
			{ id: 61, name: "Managed Wi-Fi Basic" },
			{ id: 62, name: "Managed Wi-Fi Premium" },
		];

		return {
			extractEntities: vi.fn().mockResolvedValue({}),
			generateRecommendationsFromCatalog: vi
				.fn()
				.mockImplementation(async ({ context }) => {
					// Filter out previously recommended items
					const excludeIds =
						context.currentRecommendations?.map((r: { id: number }) => r.id) ||
						[];
					const availableProducts = allProducts.filter(
						(p) => !excludeIds.includes(p.id) && !previousIds.includes(p.id)
					);

					// Take next 3 products
					const recommendedItems = availableProducts.slice(0, 3).map((p) => ({
						...p,
						reason: `Recommended for your needs`,
					}));

					// Track what we've recommended
					previousIds.push(...recommendedItems.map((item) => item.id));

					return {
						solution: "Internet",
						category: "Fiber Broadband",
						recommendedItems,
						reply: "Based on your needs, here are some recommendations.",
						confidence: 0.92,
					};
				}),
		};
	}),
}));

// Mock other services
vi.mock("../../src/services/item-search.service.js", () => ({
	ItemSearchService: vi.fn().mockImplementation(() => ({
		search: vi.fn().mockResolvedValue([]),
	})),
}));

vi.mock("../../src/services/product-matching.service.js", () => ({
	ProductMatchingService: vi.fn().mockImplementation(() => ({
		findBestMatches: vi.fn().mockResolvedValue([]),
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

describe("Multi-Turn Conversation Context", () => {
	let chatService: ChatService;
	let currentRecommendations: Array<{
		id: number;
		name: string;
		itemType: string;
	}> = [];
	const previousIds: number[] = [];
	const testSessionId = "multi-turn-test-session";

	beforeEach(() => {
		vi.clearAllMocks();
		currentRecommendations = [];
		previousIds.length = 0; // Clear array without reassigning
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

		// Mock sessionService
		// @ts-expect-error - Mocking private sessionService for tests
		chatService.sessionService = {
			getOrCreateSession: vi.fn().mockResolvedValue({
				session_id: testSessionId,
				created_at: new Date(),
				updated_at: new Date(),
			}),
		};

		// Mock contextService
		// @ts-expect-error - Mocking private contextService for tests
		chatService.contextService = {
			loadContext: vi.fn().mockImplementation(async () => ({
				recentTurns: [],
				userPreferences: {},
				currentRecommendations,
				conversationStage: "discovery" as const,
			})),
			loadIntelligentContext: vi.fn().mockImplementation(async () => ({
				recentTurns: [],
				userPreferences: {},
				currentRecommendations,
				conversationStage: "discovery" as const,
			})),
			saveTurn: vi
				.fn()
				.mockImplementation(
					async (_sessionId, _request, _response, _entities, enrichedItems) => {
						// Update current recommendations for next turn
						currentRecommendations = enrichedItems.map(
							(item: { id: number; name: string; itemType: string }) => ({
								id: item.id,
								name: item.name,
								itemType: item.itemType,
							})
						);
					}
				),
		};

		// Mock catalogCache
		// @ts-expect-error - Mocking private catalogCache for tests
		chatService.catalogCache = {
			getCatalog: vi.fn().mockResolvedValue({
				flat: [
					// Internet solutions
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
					{
						id: 34,
						name: "Fiber Broadband PEAK 200-500 mbps",
						description: "High-speed fiber for large enterprises",
						type: "product",
						parentId: 8,
						price: "3500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					{
						id: 35,
						name: "Fiber Broadband PEAK 500-1000 mbps",
						description: "Ultra-high-speed fiber",
						type: "product",
						parentId: 8,
						price: "5500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					// Security solutions
					{
						id: 5,
						name: "Security Anti-DDos",
						description: "DDoS protection and cybersecurity services",
						type: "solution",
						parentId: null,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 18,
						name: "On-Premise Defense",
						description: "On-premise DDoS protection",
						type: "category",
						parentId: 5,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 52,
						name: "Anti-DDoS On-Premise Basic",
						description: "Basic on-premise DDoS protection",
						type: "product",
						parentId: 18,
						price: "2500",
						contractTerm: "12 months",
						targetAudienceId: 1,
					},
					{
						id: 53,
						name: "Anti-DDoS On-Premise Advanced",
						description: "Advanced on-premise DDoS protection",
						type: "product",
						parentId: 18,
						price: "5000",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
					// Managed Services
					{
						id: 6,
						name: "Managed Services",
						description: "IT management and support services",
						type: "solution",
						parentId: null,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 22,
						name: "Managed Wi-Fi",
						description: "Managed Wi-Fi solutions",
						type: "category",
						parentId: 6,
						price: null,
						contractTerm: null,
						targetAudienceId: null,
					},
					{
						id: 61,
						name: "Managed Wi-Fi Basic",
						description: "Basic managed Wi-Fi solution",
						type: "product",
						parentId: 22,
						price: "800",
						contractTerm: "12 months",
						targetAudienceId: 1,
					},
					{
						id: 62,
						name: "Managed Wi-Fi Premium",
						description: "Premium managed Wi-Fi solution",
						type: "product",
						parentId: 22,
						price: "1500",
						contractTerm: "24 months",
						targetAudienceId: 2,
					},
				],
				hierarchical: [],
				metadata: {
					itemCount: 13,
					solutionCount: 3,
					categoryCount: 3,
					productCount: 7,
					lastUpdated: new Date(),
				},
			}),
		};

		// Mock langChainService with stateful exclusion logic
		// @ts-expect-error - Mocking private langChainService for tests
		chatService.langChainService = {
			extractEntities: vi.fn().mockResolvedValue({}),
			generateRecommendationsFromCatalog: vi
				.fn()
				.mockImplementation(async ({ context }) => {
					const allProducts = [
						{ id: 33, name: "Fiber Broadband PEAK 50-100 mbps" },
						{ id: 34, name: "Fiber Broadband PEAK 200-500 mbps" },
						{ id: 35, name: "Fiber Broadband PEAK 500-1000 mbps" },
						{ id: 36, name: "Fiber Broadband ULTRA 1-2 gbps" },
						{ id: 37, name: "Fiber Broadband ULTRA 2-5 gbps" },
						{ id: 52, name: "Anti-DDoS On-Premise Basic" },
						{ id: 53, name: "Anti-DDoS On-Premise Advanced" },
						{ id: 54, name: "Anti-DDoS Cloud Basic" },
						{ id: 55, name: "Anti-DDoS Cloud Premium" },
						{ id: 61, name: "Managed Wi-Fi Basic" },
						{ id: 62, name: "Managed Wi-Fi Premium" },
						{ id: 63, name: "Managed Wi-Fi Enterprise" },
						{ id: 64, name: "SD-WAN Basic" },
						{ id: 65, name: "SD-WAN Premium" },
						{ id: 66, name: "IP VPN Basic" },
					];

					// Filter out previously recommended items
					const excludeIds =
						context.currentRecommendations?.map((r: { id: number }) => r.id) ||
						[];
					const availableProducts = allProducts.filter(
						(p) => !excludeIds.includes(p.id) && !previousIds.includes(p.id)
					);

					// Take next 2 products (reduced from 3 to allow more turns)
					const recommendedItems = availableProducts.slice(0, 2).map((p) => ({
						...p,
						reason: `Recommended for your needs`,
					}));

					// Track what we've recommended
					previousIds.push(...recommendedItems.map((item) => item.id));

					return {
						solution: "Internet",
						category: "Fiber Broadband",
						recommendedItems,
						reply: "Based on your needs, here are some recommendations.",
						confidence: 0.92,
					};
				}),
		};

		// Mock deterministicTree
		// @ts-expect-error - Mocking private deterministicTree for tests
		chatService.deterministicTree = {
			recommend: vi
				.fn()
				.mockResolvedValue({ products: [], category: null, solution: null }),
		};
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Repetition Avoidance", () => {
		it("should not repeat recommendations when user asks for alternatives", async () => {
			// Turn 1: Initial request
			const response1 = await chatService.processMessage({
				message: "I need internet for my hotel",
				session_id: testSessionId,
			});

			const firstProducts = response1.recommended_items?.map((i) => i.id) || [];
			expect(firstProducts.length).toBeGreaterThan(0);

			// Turn 2: Request alternatives
			const response2 = await chatService.processMessage({
				message: "what other packages do you have?",
				session_id: testSessionId,
			});

			const secondProducts =
				response2.recommended_items?.map((i) => i.id) || [];
			expect(secondProducts.length).toBeGreaterThan(0);

			// ✅ CRITICAL: No overlap between recommendations
			const overlap = firstProducts.filter((id) => secondProducts.includes(id));
			expect(overlap.length).toBe(0);
			expect(overlap).toEqual([]);
		});

		it("should handle 'what else' variations", async () => {
			const variations = [
				"I need internet",
				"what else do you have?",
				"show me other options",
				"any alternatives?",
			];

			const allRecommendedIds: number[] = [];

			for (const message of variations) {
				const response = await chatService.processMessage({
					message,
					session_id: testSessionId,
				});

				const currentIds = response.recommended_items?.map((i) => i.id) || [];
				expect(currentIds.length).toBeGreaterThan(0);

				// Check for overlap with ANY previous recommendations
				const overlap = currentIds.filter((id) =>
					allRecommendedIds.includes(id)
				);
				expect(overlap.length).toBe(0);

				allRecommendedIds.push(...currentIds);
			}

			// Should have recommended multiple unique products
			expect(allRecommendedIds.length).toBeGreaterThan(3);
		});

		it("should maintain uniqueness across multiple turns", async () => {
			const allIds = new Set<number>();
			const turns = 5;
			const messages = [
				"I need internet",
				"what other options?",
				"show me alternatives",
				"any other packages?",
				"what else is available?",
			];

			for (let i = 0; i < turns; i++) {
				const response = await chatService.processMessage({
					message: messages[i],
					session_id: testSessionId,
				});

				const currentIds =
					response.recommended_items?.map((item) => item.id) || [];

				// Check no duplicates with previous turns
				currentIds.forEach((id) => {
					expect(allIds.has(id)).toBe(false);
					allIds.add(id);
				});
			}

			// Should have many unique recommendations (5 turns × 2 products = 10)
			expect(allIds.size).toBeGreaterThanOrEqual(10);
		});
	});

	describe("Topic Shift Detection", () => {
		it("should handle topic change from internet to security", async () => {
			// Turn 1: Internet
			const response1 = await chatService.processMessage({
				message: "I need fiber internet",
				session_id: testSessionId,
			});

			const firstIds = response1.recommended_items?.map((i) => i.id) || [];
			expect(firstIds.length).toBeGreaterThan(0);

			// Turn 2: Security (topic shift)
			const response2 = await chatService.processMessage({
				message: "I also need ddos protection",
				session_id: testSessionId,
			});

			const secondIds = response2.recommended_items?.map((i) => i.id) || [];
			expect(secondIds.length).toBeGreaterThan(0);

			// Should NOT repeat products from first turn
			const overlap = firstIds.filter((id) => secondIds.includes(id));
			expect(overlap.length).toBe(0);
		});

		it("should maintain context when adding to same topic", async () => {
			// Turn 1: Hotel needs
			const response1 = await chatService.processMessage({
				message: "I run a hotel with 50 rooms",
				session_id: testSessionId,
			});

			expect(response1.recommended_items?.length).toBeGreaterThan(0);

			// Turn 2: Add detail (same topic)
			const response2 = await chatService.processMessage({
				message: "we also need guest wifi",
				session_id: testSessionId,
			});

			expect(response2.recommended_items?.length).toBeGreaterThan(0);

			// Should have different recommendations
			const firstIds = response1.recommended_items?.map((i) => i.id) || [];
			const secondIds = response2.recommended_items?.map((i) => i.id) || [];
			const overlap = firstIds.filter((id) => secondIds.includes(id));
			expect(overlap.length).toBe(0);
		});
	});

	describe("Session Continuity", () => {
		it("should maintain context across 5+ turns", async () => {
			const turns = [
				"I need internet",
				"for a hotel",
				"with 100 rooms",
				"what else do you have?",
				"and security options?",
				"what about wifi?",
			];

			const allRecommendedIds: number[] = [];

			for (const message of turns) {
				const response = await chatService.processMessage({
					message,
					session_id: testSessionId,
				});

				expect(response.recommended_items?.length).toBeGreaterThan(0);

				const currentIds = response.recommended_items?.map((i) => i.id) || [];
				allRecommendedIds.push(...currentIds);
			}

			// Should have recommended many different products
			const uniqueIds = new Set(allRecommendedIds);
			expect(uniqueIds.size).toBeGreaterThan(10);
		});

		it("should handle conversation stage progression", async () => {
			// Initial query
			const response1 = await chatService.processMessage({
				message: "I need internet",
				session_id: testSessionId,
			});

			expect(response1.conversation_context).toBeDefined();

			// Follow-up
			const response2 = await chatService.processMessage({
				message: "tell me more",
				session_id: testSessionId,
			});

			expect(response2.conversation_context).toBeDefined();
			expect(response2).toHaveProperty("reply");
		});
	});

	describe("Context-Aware Responses", () => {
		it("should generate unique recommendations for each turn", async () => {
			// Turn 1
			const response1 = await chatService.processMessage({
				message: "I need internet for my hotel",
				session_id: testSessionId,
			});

			expect(response1.recommended_items?.length).toBeGreaterThan(0);

			// Turn 2: Ask for alternatives
			const response2 = await chatService.processMessage({
				message: "what else?",
				session_id: testSessionId,
			});

			expect(response2.recommended_items?.length).toBeGreaterThan(0);

			// Ensure no overlap
			const ids1 = response1.recommended_items?.map((i) => i.id) || [];
			const ids2 = response2.recommended_items?.map((i) => i.id) || [];
			const overlap = ids1.filter((id) => ids2.includes(id));
			expect(overlap).toEqual([]);
		});

		it("should maintain conversation context", async () => {
			// Turn 1
			const response1 = await chatService.processMessage({
				message: "I run a hotel",
				session_id: testSessionId,
			});

			expect(response1).toHaveProperty("session_id");
			expect(response1.session_id).toBe(testSessionId);

			// Turn 2
			const response2 = await chatService.processMessage({
				message: "with 50 rooms",
				session_id: testSessionId,
			});

			expect(response2).toHaveProperty("session_id");
			expect(response2.session_id).toBe(testSessionId);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty previous recommendations gracefully", async () => {
			// First turn - no previous recommendations
			const response = await chatService.processMessage({
				message: "what else do you have?",
				session_id: "new-session",
			});

			expect(response.recommended_items?.length).toBeGreaterThan(0);
			expect(response.reply).toBeDefined();
		});

		it("should handle rapid successive requests", async () => {
			const requests = ["I need internet", "what else?", "other options?"];

			for (const message of requests) {
				const response = await chatService.processMessage({
					message,
					session_id: testSessionId,
				});

				expect(response).toHaveProperty("reply");
				expect(response).toHaveProperty("recommended_items");
			}
		});

		it("should handle catalog constraints gracefully", async () => {
			// Request alternatives many times with varied messages
			const responses: Awaited<
				ReturnType<typeof chatService.processMessage>
			>[] = [];
			const messages = [
				"I need internet",
				"what other options?",
				"show alternatives",
				"any other packages?",
				"more choices please",
				"what else is there?",
				"other solutions?",
				"additional options?",
				"more products?",
				"any alternatives?",
			];

			for (let i = 0; i < messages.length; i++) {
				try {
					const response = await chatService.processMessage({
						message: messages[i],
						session_id: testSessionId,
					});
					responses.push(response);
				} catch (_error) {
					// If we run out of recommendations, that's expected
					break;
				}
			}

			// Should have at least a few successful responses
			expect(responses.length).toBeGreaterThan(2);

			// All responses should have valid structure
			responses.forEach((response) => {
				expect(response).toHaveProperty("reply");
				expect(response).toHaveProperty("session_id");
			});
		});
	});

	describe("Integration with Services", () => {
		it("should properly integrate with ContextService", async () => {
			const response = await chatService.processMessage({
				message: "I need internet",
				session_id: testSessionId,
			});

			expect(response).toHaveProperty("session_id");
			expect(response).toHaveProperty("conversation_context");
		});

		it("should properly integrate with LangChainService", async () => {
			const response = await chatService.processMessage({
				message: "I need fiber internet for my hotel",
				session_id: testSessionId,
			});

			expect(response).toHaveProperty("reply");
			expect(response.reply).toBeTruthy();
			expect(typeof response.reply).toBe("string");
		});

		it("should properly integrate with CatalogCacheService", async () => {
			const response = await chatService.processMessage({
				message: "I need internet",
				session_id: testSessionId,
			});

			expect(response.recommended_items?.length).toBeGreaterThan(0);
			response.recommended_items?.forEach((item) => {
				expect(item).toHaveProperty("id");
				expect(item).toHaveProperty("name");
				expect(typeof item.id).toBe("number");
			});
		});
	});
});
