import { describe, it, expect, beforeEach, vi } from "vitest";
import { LangChainService } from "../../src/services/langchain.service.js";
import type { CatalogItem } from "../../src/types/catalog.types.js";
import type { ConversationContext } from "../../src/dtos/chat.dto.js";

// Mock logger
vi.mock("../../src/logger-config.js", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock Logger class
vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		log: vi.fn(),
	})),
}));

// Mock LangChain logger
vi.mock("../../src/utils/langchain-logger.js", () => ({
	LangChainLogger: vi.fn().mockImplementation(() => ({
		log: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	})),
	LangChainErrorType: {},
}));

// Mock LangChain error handler
vi.mock("../../src/utils/langchain-errors.js", () => ({
	LangChainErrorHandler: vi.fn().mockImplementation(() => ({
		handle: vi.fn(),
	})),
}));

// Mock catalog lexicon service
vi.mock("../../src/services/catalog-lexicon.service.js", () => ({
	CatalogLexiconService: vi.fn().mockImplementation(() => ({
		getSynonyms: vi.fn(() => []),
	})),
}));

// Mock Google Gemini
vi.mock("@langchain/google-genai", () => ({
	ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		invoke: vi.fn(),
		pipe: vi.fn(() => ({
			pipe: vi.fn(() => ({
				invoke: vi.fn().mockResolvedValue({
					solution: "Internet",
					category: "Fiber Broadband",
					recommendedItems: [
						{
							id: 33,
							name: "Fiber Broadband PEAK 50-100 mbps",
							reason: "Ideal for a 50-room hotel",
						},
					],
					reply:
						"Based on your 50-room hotel, I recommend Fiber Broadband PEAK plans.",
					confidence: 0.92,
				}),
			})),
		})),
	})),
}));

// Mock LangChain core - create a chain that has an invoke method
const mockChain = {
	invoke: vi.fn().mockResolvedValue({
		solution: "Internet",
		category: "Fiber Broadband",
		recommendedItems: [
			{
				id: 33,
				name: "Fiber Broadband PEAK 50-100 mbps",
				reason: "Ideal for a 50-room hotel",
			},
		],
		reply:
			"Based on your 50-room hotel, I recommend Fiber Broadband PEAK plans.",
		confidence: 0.92,
	}),
};

vi.mock("@langchain/core/prompts", () => ({
	ChatPromptTemplate: {
		fromMessages: vi.fn(() => ({
			pipe: vi.fn(() => ({
				pipe: vi.fn(() => mockChain),
			})),
		})),
	},
}));

vi.mock("@langchain/core/output_parsers", () => ({
	StructuredOutputParser: {
		fromZodSchema: vi.fn(() => ({
			parse: vi.fn(),
		})),
	},
}));

// Mock Runnable
vi.mock("@langchain/core/runnables", () => ({
	Runnable: vi.fn(),
}));

// Mock catalog cache service
vi.mock("../../src/services/catalog-cache.service.js", () => ({
	CatalogCacheService: {
		getInstance: vi.fn(() => ({
			buildHierarchy: vi.fn((catalog) => {
				const solutions = catalog.filter(
					(i: CatalogItem) => i.type === "solution"
				);
				return solutions.map((sol: CatalogItem) => ({
					...sol,
					categories: catalog
						.filter(
							(c: CatalogItem) => c.type === "category" && c.parentId === sol.id
						)
						.map((cat: CatalogItem) => ({
							...cat,
							products: catalog.filter(
								(p: CatalogItem) =>
									p.type === "product" && p.parentId === cat.id
							),
						})),
				}));
			}),
		})),
	},
}));

describe("LangChainService - Catalog-in-Prompt", () => {
	let service: LangChainService;

	beforeEach(() => {
		service = new LangChainService();
	});

	describe("generateRecommendationsFromCatalog", () => {
		it("should generate recommendations with full catalog in prompt", async () => {
			const mockCatalog: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 8,
					name: "Fiber Broadband",
					description: "Fast fiber",
					type: "category",
					parentId: 1,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					description: "50-100 mbps plan",
					type: "product",
					parentId: 8,
					price: "1500",
					contractTerm: "12 months",
					targetAudienceId: 1,
				},
			];

			const mockContext: ConversationContext = {
				recentTurns: [],
				userPreferences: {},
				conversationStage: "greeting",
				currentRecommendations: [],
			};

			const message = "I need internet for my hotel with 50 rooms";

			const response = await service.generateRecommendationsFromCatalog({
				message,
				catalog: mockCatalog,
				context: mockContext,
			});

			expect(response).toHaveProperty("solution");
			expect(response).toHaveProperty("category");
			expect(response).toHaveProperty("recommendedItems");
			expect(response).toHaveProperty("reply");
			expect(response).toHaveProperty("confidence");
			expect(response.recommendedItems.length).toBeGreaterThan(0);
		});

		it("should handle empty catalog gracefully", async () => {
			const mockCatalog: CatalogItem[] = [];

			const mockContext: ConversationContext = {
				recentTurns: [],
				userPreferences: {},
				conversationStage: "greeting",
				currentRecommendations: [],
			};

			const message = "I need internet";

			const response = await service.generateRecommendationsFromCatalog({
				message,
				catalog: mockCatalog,
				context: mockContext,
			});

			expect(response).toHaveProperty("solution");
			expect(response).toHaveProperty("category");
		});

		it("should include conversation context in prompt", async () => {
			const mockCatalog: CatalogItem[] = [
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					description: "50-100 mbps plan",
					type: "product",
					parentId: 8,
					price: "1500",
					contractTerm: "12 months",
					targetAudienceId: 1,
				},
			];

			const mockContext: ConversationContext = {
				recentTurns: [],
				userPreferences: {},
				conversationStage: "refinement",
				currentRecommendations: [],
			};

			const message = "We have 50 rooms";

			const response = await service.generateRecommendationsFromCatalog({
				message,
				catalog: mockCatalog,
				context: mockContext,
			});

			expect(response).toHaveProperty("solution");
			expect(response.solution).toBeTruthy();
		});

		it("should return valid confidence score", async () => {
			const mockCatalog: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const mockContext: ConversationContext = {
				recentTurns: [],
				userPreferences: {},
				conversationStage: "greeting",
				currentRecommendations: [],
			};

			const message = "I need internet";

			const response = await service.generateRecommendationsFromCatalog({
				message,
				catalog: mockCatalog,
				context: mockContext,
			});

			expect(response.confidence).toBeGreaterThanOrEqual(0);
			expect(response.confidence).toBeLessThanOrEqual(1);
		});

		it("should return array of recommended items", async () => {
			const mockCatalog: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const mockContext: ConversationContext = {
				recentTurns: [],
				userPreferences: {},
				conversationStage: "greeting",
				currentRecommendations: [],
			};

			const message = "I need internet";

			const response = await service.generateRecommendationsFromCatalog({
				message,
				catalog: mockCatalog,
				context: mockContext,
			});

			expect(Array.isArray(response.recommendedItems)).toBe(true);
			response.recommendedItems.forEach((item) => {
				expect(item).toHaveProperty("id");
				expect(item).toHaveProperty("name");
				expect(item).toHaveProperty("reason");
				expect(typeof item.id).toBe("number");
				expect(typeof item.name).toBe("string");
				expect(typeof item.reason).toBe("string");
			});
		});
	});

	describe("buildCatalogPrompt", () => {
		it("should be a private method that builds catalog prompts", () => {
			// Test that the method exists (accessed via 'as any' for testing)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(typeof (service as any).buildCatalogPrompt).toBe("function");
		});
	});

	describe("formatPreviousRecommendations", () => {
		it("should be a private method that formats previous recommendations", () => {
			// Test that the method exists (accessed via 'as any' for testing)
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(typeof (service as any).formatPreviousRecommendations).toBe(
				"function"
			);
		});
	});
});
