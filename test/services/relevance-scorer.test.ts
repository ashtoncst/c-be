/**
 * Unit Tests for RelevanceScorer
 *
 * Testing Strategy (TDD):
 * 1. Test instantiation and dependencies
 * 2. Test single turn scoring
 * 3. Test batch scoring
 * 4. Test caching behavior
 * 5. Test error handling
 * 6. Test score parsing and validation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { RelevanceScorer } from "../../src/services/relevance-scorer.service.js";
import type { ConversationTurn } from "../../src/dtos/chat.dto.js";
import type { RelevanceScore } from "../../src/types/intelligent-context.types.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

describe("RelevanceScorer", () => {
	let scorer: RelevanceScorer;
	let mockGeminiClient: ChatGoogleGenerativeAI;

	beforeEach(() => {
		// Create mock Gemini client
		mockGeminiClient = {
			invoke: vi.fn(),
		} as unknown as ChatGoogleGenerativeAI;

		scorer = new RelevanceScorer(mockGeminiClient);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Instantiation", () => {
		it("should create instance successfully", () => {
			expect(scorer).toBeDefined();
			expect(scorer).toBeInstanceOf(RelevanceScorer);
		});

		it("should have scoreRelevance method", () => {
			expect(scorer.scoreRelevance).toBeDefined();
			expect(typeof scorer.scoreRelevance).toBe("function");
		});

		it("should have scoreBatch method", () => {
			expect(scorer.scoreBatch).toBeDefined();
			expect(typeof scorer.scoreBatch).toBe("function");
		});

		it("should have clearCache method", () => {
			expect(scorer.clearCache).toBeDefined();
			expect(typeof scorer.clearCache).toBe("function");
		});
	});

	describe("scoreRelevance - Single Turn Scoring", () => {
		const mockTurn: ConversationTurn = {
			userMessage: "I need internet for my 50-room hotel",
			botResponse: "For a 50-room hotel, I recommend Fiber Broadband PEAK...",
			extractedEntities: {},
			timestamp: new Date("2025-01-01T10:00:00Z"),
		};

		it("should score a highly relevant turn (score 8-10)", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 9,
					reason: "Directly related to current query about hotel internet",
					directReference: true,
					topicContinuation: true,
					contextualDependency: true,
					informationValue: 9,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance(
				"What are the installation requirements for hotel internet?",
				mockTurn,
				0
			);

			expect(result).toBeDefined();
			expect(result.turnIndex).toBe(0);
			expect(result.score).toBeGreaterThanOrEqual(8);
			expect(result.score).toBeLessThanOrEqual(10);
			expect(result.reason).toContain("hotel");
			expect(result.categories.directReference).toBe(true);
			expect(result.categories.topicContinuation).toBe(true);
		});

		it("should score a moderately relevant turn (score 4-6)", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 5,
					reason: "Related but not directly addressing current query",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 5,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance(
				"What about security options?",
				mockTurn,
				0
			);

			expect(result.score).toBeGreaterThanOrEqual(4);
			expect(result.score).toBeLessThanOrEqual(6);
			expect(result.categories.directReference).toBe(false);
		});

		it("should score an irrelevant turn (score 0-3)", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 2,
					reason:
						"Unrelated topic - query is about cameras, turn is about internet",
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 2,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance(
				"Do you have security cameras?",
				mockTurn,
				0
			);

			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(3);
			expect(result.categories.topicContinuation).toBe(false);
		});

		it("should include turnIndex in result", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 3);

			expect(result.turnIndex).toBe(3);
		});

		it("should validate score is between 0-10", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 0);

			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(10);
		});
	});

	describe("scoreBatch - Batch Scoring", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "I need internet for my hotel",
				botResponse: "We offer Fiber Broadband...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "We have 50 rooms",
				botResponse: "For a 50-room hotel...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
			{
				userMessage: "What about cameras?",
				botResponse: "We have security cameras...",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:10:00Z"),
			},
		];

		it("should score multiple turns in batch", async () => {
			const mockResponses = [
				{
					content: JSON.stringify({
						score: 9,
						reason: "Highly relevant",
						directReference: true,
						topicContinuation: true,
						contextualDependency: true,
						informationValue: 9,
					}),
				},
				{
					content: JSON.stringify({
						score: 8,
						reason: "Very relevant",
						directReference: false,
						topicContinuation: true,
						contextualDependency: true,
						informationValue: 8,
					}),
				},
				{
					content: JSON.stringify({
						score: 3,
						reason: "Less relevant",
						directReference: false,
						topicContinuation: false,
						contextualDependency: false,
						informationValue: 3,
					}),
				},
			];

			let callCount = 0;
			vi.mocked(mockGeminiClient.invoke).mockImplementation(async () => {
				return mockResponses[callCount++] as never;
			});

			const results = await scorer.scoreBatch(
				"What are installation requirements?",
				mockTurns
			);

			expect(results).toHaveLength(3);
			expect(results[0].score).toBe(9);
			expect(results[1].score).toBe(8);
			expect(results[2].score).toBe(3);
			expect(results[0].turnIndex).toBe(0);
			expect(results[1].turnIndex).toBe(1);
			expect(results[2].turnIndex).toBe(2);
		});

		it("should handle empty turns array", async () => {
			const results = await scorer.scoreBatch("test query", []);

			expect(results).toHaveLength(0);
			expect(results).toEqual([]);
		});

		it("should score turns in parallel", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 5,
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 5,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			await scorer.scoreBatch("test query", mockTurns);

			// Parallel execution - all invocations should happen
			// With 3 turns, we expect 3 parallel calls
			expect(mockGeminiClient.invoke).toHaveBeenCalledTimes(3);
		});
	});

	describe("Caching Behavior", () => {
		const mockTurn: ConversationTurn = {
			userMessage: "Test message",
			botResponse: "Test response",
			extractedEntities: {},
			timestamp: new Date("2025-01-01T10:00:00Z"),
		};

		it("should cache scores for identical query-turn pairs", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Cached test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			// First call - should hit API
			const result1 = await scorer.scoreRelevance("same query", mockTurn, 0);

			// Second call with same query and turn - should use cache
			const result2 = await scorer.scoreRelevance("same query", mockTurn, 0);

			expect(result1.score).toBe(result2.score);
			expect(mockGeminiClient.invoke).toHaveBeenCalledTimes(1); // Only once!
		});

		it("should not use cache for different queries", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			await scorer.scoreRelevance("query 1", mockTurn, 0);
			await scorer.scoreRelevance("query 2", mockTurn, 0);

			expect(mockGeminiClient.invoke).toHaveBeenCalledTimes(2);
		});

		it("should clear cache when clearCache is called", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			// First call
			await scorer.scoreRelevance("same query", mockTurn, 0);

			// Clear cache
			scorer.clearCache();

			// Second call - should hit API again
			await scorer.scoreRelevance("same query", mockTurn, 0);

			expect(mockGeminiClient.invoke).toHaveBeenCalledTimes(2);
		});
	});

	describe("Error Handling", () => {
		const mockTurn: ConversationTurn = {
			userMessage: "Test",
			botResponse: "Test response",
			extractedEntities: {},
			timestamp: new Date(),
		};

		it("should handle Gemini API errors gracefully", async () => {
			vi.mocked(mockGeminiClient.invoke).mockRejectedValue(
				new Error("API Error")
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 0);

			// Should return fallback score
			expect(result).toBeDefined();
			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.score).toBeLessThanOrEqual(10);
			expect(result.reason.toLowerCase()).toContain("error");
		});

		it("should handle malformed JSON responses", async () => {
			const mockResponse = {
				content: "This is not valid JSON",
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 0);

			expect(result).toBeDefined();
			expect(result.score).toBeGreaterThanOrEqual(0);
			expect(result.reason).toBeDefined();
		});

		it("should handle partial JSON responses", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Partial response",
					// Missing other fields
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 0);

			expect(result).toBeDefined();
			expect(result.score).toBe(7);
			expect(result.categories).toBeDefined();
		});

		it("should handle invalid score values (out of range)", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 15, // Invalid: > 10
					reason: "Test",
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 7,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const result = await scorer.scoreRelevance("test query", mockTurn, 0);

			// Should clamp to valid range
			expect(result.score).toBeLessThanOrEqual(10);
		});

		it("should handle failed turns in batch scoring", async () => {
			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Turn 1",
					botResponse: "Response 1",
					extractedEntities: {},
					timestamp: new Date(),
				},
				{
					userMessage: "Turn 2",
					botResponse: "Response 2",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			let callCount = 0;
			vi.mocked(mockGeminiClient.invoke).mockImplementation(async () => {
				if (callCount++ === 0) {
					throw new Error("First call fails");
				}
				return {
					content: JSON.stringify({
						score: 7,
						reason: "Success",
						directReference: false,
						topicContinuation: true,
						contextualDependency: false,
						informationValue: 7,
					}),
				} as never;
			});

			const results = await scorer.scoreBatch("test query", mockTurns);

			// Should still return results for all turns (with fallback for failed one)
			expect(results).toHaveLength(2);
			expect(results[0]).toBeDefined(); // Fallback score
			expect(results[1]).toBeDefined(); // Success score
		});
	});

	describe("Type Safety", () => {
		it("should return properly typed RelevanceScore", async () => {
			const mockResponse = {
				content: JSON.stringify({
					score: 7,
					reason: "Type test",
					directReference: true,
					topicContinuation: false,
					contextualDependency: true,
					informationValue: 6,
				}),
			};

			vi.mocked(mockGeminiClient.invoke).mockResolvedValue(
				mockResponse as never
			);

			const mockTurn: ConversationTurn = {
				userMessage: "Test",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date(),
			};

			const result: RelevanceScore = await scorer.scoreRelevance(
				"test",
				mockTurn,
				0
			);

			// Type structure validation
			expect(result).toHaveProperty("turnIndex");
			expect(result).toHaveProperty("score");
			expect(result).toHaveProperty("reason");
			expect(result).toHaveProperty("categories");

			expect(typeof result.turnIndex).toBe("number");
			expect(typeof result.score).toBe("number");
			expect(typeof result.reason).toBe("string");
			expect(typeof result.categories).toBe("object");

			expect(result.categories).toHaveProperty("directReference");
			expect(result.categories).toHaveProperty("topicContinuation");
			expect(result.categories).toHaveProperty("contextualDependency");
			expect(result.categories).toHaveProperty("informationValue");
		});
	});
});
