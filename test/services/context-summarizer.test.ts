/**
 * Unit Tests for ContextSummarizer
 *
 * Testing Strategy (TDD):
 * 1. Test instantiation and dependencies
 * 2. Test single-level summarization (detailed, condensed, compressed)
 * 3. Test progressive summarization
 * 4. Test fact extraction
 * 5. Test error handling
 * 6. Test type safety
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ContextSummarizer } from "../../src/services/context-summarizer.service.js";
import type { ConversationTurn } from "../../src/dtos/chat.dto.js";
import type {
	SummarizationLevel,
	ConversationFacts,
} from "../../src/types/intelligent-context.types.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

describe("ContextSummarizer", () => {
	let summarizer: ContextSummarizer;
	let mockGeminiClient: ChatGoogleGenerativeAI;

	beforeEach(() => {
		// Create mock Gemini client
		mockGeminiClient = {
			invoke: vi.fn(),
		} as unknown as ChatGoogleGenerativeAI;

		summarizer = new ContextSummarizer(mockGeminiClient);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Instantiation", () => {
		it("should create instance successfully", () => {
			expect(summarizer).toBeDefined();
			expect(summarizer).toBeInstanceOf(ContextSummarizer);
		});

		it("should have summarizeTurns method", () => {
			expect(summarizer.summarizeTurns).toBeDefined();
			expect(typeof summarizer.summarizeTurns).toBe("function");
		});

		it("should have extractFacts method", () => {
			expect(summarizer.extractFacts).toBeDefined();
			expect(typeof summarizer.extractFacts).toBe("function");
		});

		it("should have createProgressiveSummary method", () => {
			expect(summarizer.createProgressiveSummary).toBeDefined();
			expect(typeof summarizer.createProgressiveSummary).toBe("function");
		});
	});

	describe("summarizeTurns - Single Level Summarization", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "I need internet for my 50-room hotel",
				botResponse:
					"For a 50-room hotel, I recommend Fiber Broadband PEAK 200-400 mbps and Managed Wi-Fi Basic Package...",
				extractedEntities: {
					contextual_scale: "medium",
					target_audience: "Hospitality",
				},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "We also need security cameras",
				botResponse: "For security, we offer IP cameras with cloud storage...",
				extractedEntities: {
					solution: "Security",
				},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
		];

		it("should create a detailed summary (2-3 sentences)", async () => {
			const mockResponse = {
				content:
					"Customer operates a 50-room hotel and needs internet connectivity. They've been recommended Fiber Broadband PEAK 200-400 mbps with Managed Wi-Fi. Customer also expressed interest in security camera solutions.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.summarizeTurns(mockTurns, "detailed");

			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(50);
			expect(result).toContain("hotel");
			expect(mockGeminiClient.invoke).toHaveBeenCalledOnce();
		});

		it("should create a condensed summary (1-2 sentences)", async () => {
			const mockResponse = {
				content:
					"50-room hotel needs internet (recommended Fiber Broadband PEAK 200-400 mbps) and security cameras.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.summarizeTurns(mockTurns, "condensed");

			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(20);
			expect(result).toContain("hotel");
		});

		it("should create a compressed summary (1 sentence max)", async () => {
			const mockResponse = {
				content: "Hotel (50 rooms) needs internet and security.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.summarizeTurns(mockTurns, "compressed");

			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(10);
			expect(result.length).toBeLessThan(150); // Compressed should be brief
		});

		it("should handle empty turns array", async () => {
			const result = await summarizer.summarizeTurns([], "detailed");

			expect(result).toBe("");
			expect(mockGeminiClient.invoke).not.toHaveBeenCalled();
		});

		it("should include key entities in summary", async () => {
			const mockResponse = {
				content:
					"Hospitality customer with 50 rooms needs Fiber Broadband PEAK 200-400 mbps and security solutions.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.summarizeTurns(mockTurns, "detailed");

			// Summary should mention key facts
			expect(result.toLowerCase()).toMatch(/hotel|hospitality/);
			expect(result).toMatch(/50/);
			expect(result.toLowerCase()).toMatch(/internet|fiber|broadband/);
		});

		it("should respect summarization level in prompt", async () => {
			vi.mocked(mockGeminiClient.invoke).mockResolvedValue({
				content: "Summary",
			} as never);

			await summarizer.summarizeTurns(mockTurns, "compressed");

			const call = vi.mocked(mockGeminiClient.invoke).mock.calls[0][0];
			expect(call).toContain("compressed");
			expect(call).toContain("1 sentence");
		});
	});

	describe("extractFacts - Fact Extraction", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "I run a 50-room hotel in Manila",
				botResponse: "Great! For a mid-sized hotel...",
				extractedEntities: {
					target_audience: "Hospitality",
					contextual_scale: "medium",
				},
				timestamp: new Date(),
			},
			{
				userMessage: "Our budget is around 100k per month",
				botResponse: "With that budget, we can offer...",
				extractedEntities: {
					budget_indication: 100000,
					price_range: "premium",
				},
				timestamp: new Date(),
			},
			{
				userMessage: "Yes, I'll take the Fiber PEAK 200-400",
				botResponse: "Excellent choice!...",
				extractedEntities: {},
				timestamp: new Date(),
			},
			{
				userMessage: "No, I don't need security cameras",
				botResponse: "Understood, we'll focus on connectivity...",
				extractedEntities: {},
				timestamp: new Date(),
			},
		];

		it("should extract structured facts from turns", async () => {
			const mockResponse = {
				content: JSON.stringify({
					industry: "Hospitality",
					businessSize: "50 rooms",
					budget: "100k/month",
					requirements: ["internet connectivity", "managed wifi"],
					decisions: {
						accepted: ["Fiber PEAK 200-400"],
						rejected: ["security cameras"],
					},
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.extractFacts(mockTurns);

			expect(result).toBeDefined();
			expect(result.industry).toBe("Hospitality");
			expect(result.businessSize).toBe("50 rooms");
			expect(result.budget).toBe("100k/month");
			expect(result.requirements).toBeInstanceOf(Array);
			expect(result.requirements.length).toBeGreaterThan(0);
			expect(result.decisions.accepted).toContain("Fiber PEAK 200-400");
			expect(result.decisions.rejected).toContain("security cameras");
		});

		it("should handle empty requirements", async () => {
			const mockResponse = {
				content: JSON.stringify({
					requirements: [],
					decisions: {
						accepted: [],
						rejected: [],
					},
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.extractFacts(mockTurns);

			expect(result.requirements).toEqual([]);
			expect(result.decisions.accepted).toEqual([]);
			expect(result.decisions.rejected).toEqual([]);
		});

		it("should handle empty turns gracefully", async () => {
			const result = await summarizer.extractFacts([]);

			expect(result).toBeDefined();
			expect(result.requirements).toEqual([]);
			expect(result.decisions.accepted).toEqual([]);
			expect(result.decisions.rejected).toEqual([]);
			expect(mockGeminiClient.invoke).not.toHaveBeenCalled();
		});
	});

	describe("createProgressiveSummary - Progressive Summarization", () => {
		// Create turns spanning different time periods
		const recentTurns: ConversationTurn[] = [
			{
				userMessage: "What about installation timeframe?",
				botResponse: "Installation typically takes 2-3 weeks...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T11:00:00Z"),
			},
			{
				userMessage: "Perfect, let's proceed",
				botResponse: "Great! I'll prepare the proposal...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T11:05:00Z"),
			},
		];

		const midRangeTurns: ConversationTurn[] = [
			{
				userMessage: "Tell me more about Managed Wi-Fi",
				botResponse: "Managed Wi-Fi includes...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:30:00Z"),
			},
			{
				userMessage: "Yes, that sounds good",
				botResponse: "Excellent...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:35:00Z"),
			},
		];

		const olderTurns: ConversationTurn[] = [
			{
				userMessage: "I need internet for my hotel",
				botResponse: "What size is your hotel?",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "50 rooms",
				botResponse: "For a 50-room hotel...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
		];

		it("should create progressive summary with 3 levels", async () => {
			const mockCondensedResponse = {
				content:
					"Customer inquired about Managed Wi-Fi and confirmed interest.",
			};
			const mockCompressedResponse = {
				content: "Hotel (50 rooms) needs internet.",
			};

			let callCount = 0;
			vi.mocked(mockGeminiClient.invoke).mockImplementation(async () => {
				if (callCount++ === 0) return mockCondensedResponse as never;
				return mockCompressedResponse as never;
			});

			const result = await summarizer.createProgressiveSummary(
				recentTurns,
				midRangeTurns,
				olderTurns
			);

			expect(result).toBeDefined();
			expect(result.detailed).toEqual(recentTurns);
			expect(result.condensed).toBeDefined();
			expect(result.condensed).toContain("Managed Wi-Fi");
			expect(result.compressed).toBeDefined();
			expect(result.compressed!.toLowerCase()).toContain("hotel");
			expect(mockGeminiClient.invoke).toHaveBeenCalledTimes(2);
		});

		it("should handle missing mid-range turns", async () => {
			const mockCompressedResponse = {
				content: "Hotel needs internet.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockCompressedResponse as never
			);

			const result = await summarizer.createProgressiveSummary(
				recentTurns,
				[],
				olderTurns
			);

			expect(result.detailed).toEqual(recentTurns);
			expect(result.condensed).toBeUndefined();
			expect(result.compressed).toBeDefined();
			expect(mockGeminiClient.invoke).toHaveBeenCalledOnce();
		});

		it("should handle missing older turns", async () => {
			const mockCondensedResponse = {
				content: "Customer confirmed interest in Managed Wi-Fi.",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockCondensedResponse as never
			);

			const result = await summarizer.createProgressiveSummary(
				recentTurns,
				midRangeTurns,
				[]
			);

			expect(result.detailed).toEqual(recentTurns);
			expect(result.condensed).toBeDefined();
			expect(result.compressed).toBeUndefined();
			expect(mockGeminiClient.invoke).toHaveBeenCalledOnce();
		});

		it("should handle only recent turns", async () => {
			const result = await summarizer.createProgressiveSummary(
				recentTurns,
				[],
				[]
			);

			expect(result.detailed).toEqual(recentTurns);
			expect(result.condensed).toBeUndefined();
			expect(result.compressed).toBeUndefined();
			expect(mockGeminiClient.invoke).not.toHaveBeenCalled();
		});
	});

	describe("Error Handling", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "Test",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date(),
			},
		];

		it("should handle Gemini API errors in summarization", async () => {
			vi.mocked(mockGeminiClient.invoke).mockRejectedValue(
				new Error("API Error")
			);

			const result = await summarizer.summarizeTurns(mockTurns, "detailed");

			// Should return fallback summary
			expect(result).toBeDefined();
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should handle malformed JSON in fact extraction", async () => {
			const mockResponse = {
				content: "This is not valid JSON",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.extractFacts(mockTurns);

			// Should return empty facts
			expect(result).toBeDefined();
			expect(result.requirements).toEqual([]);
			expect(result.decisions.accepted).toEqual([]);
			expect(result.decisions.rejected).toEqual([]);
		});

		it("should handle partial JSON in fact extraction", async () => {
			const mockResponse = {
				content: JSON.stringify({
					industry: "Hospitality",
					// Missing other fields
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await summarizer.extractFacts(mockTurns);

			expect(result).toBeDefined();
			expect(result.industry).toBe("Hospitality");
			expect(result.requirements).toBeDefined();
			expect(result.decisions).toBeDefined();
		});

		it("should handle errors in progressive summarization", async () => {
			vi.mocked(mockGeminiClient.invoke).mockRejectedValue(
				new Error("API Error")
			);

			const result = await summarizer.createProgressiveSummary(
				mockTurns,
				mockTurns,
				mockTurns
			);

			// Should still return structure with detailed turns
			expect(result.detailed).toEqual(mockTurns);
			// Condensed and compressed may be undefined or fallback
			expect(result).toBeDefined();
		});
	});

	describe("Type Safety", () => {
		it("should accept all valid summarization levels", async () => {
			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Test",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue({
				content: "Summary",
			} as never);

			const levels: SummarizationLevel[] = [
				"detailed",
				"condensed",
				"compressed",
			];

			for (const level of levels) {
				const result = await summarizer.summarizeTurns(mockTurns, level);
				expect(result).toBeDefined();
			}
		});

		it("should return properly typed ConversationFacts", async () => {
			const mockResponse = {
				content: JSON.stringify({
					industry: "Hospitality",
					businessSize: "50 rooms",
					budget: "100k",
					requirements: ["internet"],
					decisions: {
						accepted: ["Fiber PEAK"],
						rejected: ["cameras"],
					},
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Test",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			const result: ConversationFacts = await summarizer.extractFacts(
				mockTurns
			);

			// Type structure validation
			expect(typeof result.industry).toBe("string");
			expect(typeof result.businessSize).toBe("string");
			expect(typeof result.budget).toBe("string");
			expect(Array.isArray(result.requirements)).toBe(true);
			expect(typeof result.decisions).toBe("object");
			expect(Array.isArray(result.decisions.accepted)).toBe(true);
			expect(Array.isArray(result.decisions.rejected)).toBe(true);
		});
	});
});
