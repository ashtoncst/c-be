/**
 * Unit Tests for TurnSelector
 *
 * Testing Strategy (TDD):
 * 1. Test instantiation
 * 2. Test recency-based selection (always include recent)
 * 3. Test relevance-based selection (above threshold)
 * 4. Test hybrid selection (recency + relevance)
 * 5. Test token budget enforcement
 * 6. Test maxTurns enforcement
 * 7. Test edge cases
 * 8. Test type safety
 */

import { describe, it, expect, beforeEach } from "vitest";
import { TurnSelector } from "../../src/services/turn-selector.service.js";
import type { ConversationTurn } from "../../src/dtos/chat.dto.js";
import type {
	RelevanceScore,
	SelectionStrategy,
} from "../../src/types/intelligent-context.types.js";

describe("TurnSelector", () => {
	let selector: TurnSelector;

	beforeEach(() => {
		selector = new TurnSelector();
	});

	describe("Instantiation", () => {
		it("should create instance successfully", () => {
			expect(selector).toBeDefined();
			expect(selector).toBeInstanceOf(TurnSelector);
		});

		it("should have selectOptimalTurns method", () => {
			expect(selector.selectOptimalTurns).toBeDefined();
			expect(typeof selector.selectOptimalTurns).toBe("function");
		});
	});

	describe("Recency-Based Selection", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "Turn 1",
				botResponse: "Response 1",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "Turn 2",
				botResponse: "Response 2",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
			{
				userMessage: "Turn 3",
				botResponse: "Response 3",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:10:00Z"),
			},
			{
				userMessage: "Turn 4 (most recent)",
				botResponse: "Response 4",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:15:00Z"),
			},
		];

		const mockScores: RelevanceScore[] = [
			{
				turnIndex: 0,
				score: 3,
				reason: "Low relevance",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 3,
				},
			},
			{
				turnIndex: 1,
				score: 5,
				reason: "Medium relevance",
				categories: {
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 5,
				},
			},
			{
				turnIndex: 2,
				score: 4,
				reason: "Medium-low relevance",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 4,
				},
			},
			{
				turnIndex: 3,
				score: 2,
				reason: "Low relevance but recent",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 2,
				},
			},
		];

		it("should always include most recent N turns", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2,
					currentRecommendations: false,
				},
				relevanceThreshold: 10, // High threshold to exclude by relevance
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should include 2 most recent turns (indices 2 and 3)
			expect(result).toHaveLength(2);
			expect(result[0].userMessage).toContain("Turn 3");
			expect(result[1].userMessage).toContain("Turn 4");
		});

		it("should preserve chronological order", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 3,
					currentRecommendations: false,
				},
				relevanceThreshold: 10,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			expect(result).toHaveLength(3);
			// Check chronological order (oldest to newest)
			expect(result[0].userMessage).toContain("Turn 2");
			expect(result[1].userMessage).toContain("Turn 3");
			expect(result[2].userMessage).toContain("Turn 4");
		});
	});

	describe("Relevance-Based Selection", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "Low relevance turn",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "High relevance turn",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
			{
				userMessage: "Medium relevance turn",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:10:00Z"),
			},
			{
				userMessage: "Very high relevance turn",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:15:00Z"),
			},
		];

		const mockScores: RelevanceScore[] = [
			{
				turnIndex: 0,
				score: 3,
				reason: "Low",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 3,
				},
			},
			{
				turnIndex: 1,
				score: 9,
				reason: "High",
				categories: {
					directReference: true,
					topicContinuation: true,
					contextualDependency: true,
					informationValue: 9,
				},
			},
			{
				turnIndex: 2,
				score: 6,
				reason: "Medium",
				categories: {
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 6,
				},
			},
			{
				turnIndex: 3,
				score: 10,
				reason: "Very high",
				categories: {
					directReference: true,
					topicContinuation: true,
					contextualDependency: true,
					informationValue: 10,
				},
			},
		];

		it("should include turns above relevance threshold", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 0, // Don't force recent
					currentRecommendations: false,
				},
				relevanceThreshold: 7.0, // Only scores 7+
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should include turns with score >= 7 (indices 1 and 3)
			expect(result).toHaveLength(2);
			expect(result[0].userMessage).toContain("High relevance");
			expect(result[1].userMessage).toContain("Very high relevance");
		});

		it("should exclude turns below relevance threshold", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 0,
					currentRecommendations: false,
				},
				relevanceThreshold: 6.0,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should exclude turn with score 3 (index 0)
			expect(result).toHaveLength(3);
			expect(
				result.find((t) => t.userMessage.includes("Low relevance"))
			).toBeUndefined();
		});
	});

	describe("Hybrid Selection (Recency + Relevance)", () => {
		const mockTurns: ConversationTurn[] = [
			{
				userMessage: "Old, low relevance",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:00:00Z"),
			},
			{
				userMessage: "Old, high relevance",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:05:00Z"),
			},
			{
				userMessage: "Recent, low relevance",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:10:00Z"),
			},
			{
				userMessage: "Recent, medium relevance",
				botResponse: "Response",
				extractedEntities: {},
				timestamp: new Date("2025-01-01T10:15:00Z"),
			},
		];

		const mockScores: RelevanceScore[] = [
			{
				turnIndex: 0,
				score: 2,
				reason: "Low",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 2,
				},
			},
			{
				turnIndex: 1,
				score: 9,
				reason: "High",
				categories: {
					directReference: true,
					topicContinuation: true,
					contextualDependency: true,
					informationValue: 9,
				},
			},
			{
				turnIndex: 2,
				score: 3,
				reason: "Low",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 3,
				},
			},
			{
				turnIndex: 3,
				score: 5,
				reason: "Medium",
				categories: {
					directReference: false,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 5,
				},
			},
		];

		it("should include both recent turns AND relevant turns", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2, // Include 2 most recent (indices 2, 3)
					currentRecommendations: false,
				},
				relevanceThreshold: 7.0, // Also include score >= 7 (index 1)
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should include indices 1 (high relevance), 2, 3 (recent)
			expect(result).toHaveLength(3);
			expect(
				result.find((t) => t.userMessage.includes("Old, high relevance"))
			).toBeDefined();
			expect(
				result.find((t) => t.userMessage.includes("Recent, low relevance"))
			).toBeDefined();
			expect(
				result.find((t) => t.userMessage.includes("Recent, medium relevance"))
			).toBeDefined();
		});

		it("should not duplicate turns selected by both criteria", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2, // Includes index 3 (score 5)
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0, // Also includes index 3 (score 5)
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should not duplicate index 3
			const recentMediumCount = result.filter((t) =>
				t.userMessage.includes("Recent, medium relevance")
			).length;
			expect(recentMediumCount).toBe(1);
		});
	});

	describe("MaxTurns Enforcement", () => {
		const mockTurns: ConversationTurn[] = Array.from(
			{ length: 10 },
			(_, i) => ({
				userMessage: `Turn ${i + 1}`,
				botResponse: `Response ${i + 1}`,
				extractedEntities: {},
				timestamp: new Date(
					`2025-01-01T10:${i.toString().padStart(2, "0")}:00Z`
				),
			})
		);

		const mockScores: RelevanceScore[] = Array.from({ length: 10 }, (_, i) => ({
			turnIndex: i,
			score: 8, // All high relevance
			reason: "High",
			categories: {
				directReference: true,
				topicContinuation: true,
				contextualDependency: true,
				informationValue: 8,
			},
		}));

		it("should respect maxTurns limit", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2,
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0, // Would include all 10 turns
				maxTurns: 5, // But limit to 5
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			expect(result).toHaveLength(5);
		});

		it("should prioritize recent turns when exceeding maxTurns", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 3,
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0,
				maxTurns: 5,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			expect(result).toHaveLength(5);
			// Should include most recent turns
			expect(result[result.length - 1].userMessage).toContain("Turn 10");
			expect(result[result.length - 2].userMessage).toContain("Turn 9");
			expect(result[result.length - 3].userMessage).toContain("Turn 8");
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty turns array", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2,
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns([], [], strategy);

			expect(result).toEqual([]);
		});

		it("should handle mismatched turns and scores length", () => {
			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Turn 1",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
				{
					userMessage: "Turn 2",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			const mockScores: RelevanceScore[] = [
				{
					turnIndex: 0,
					score: 8,
					reason: "Test",
					categories: {
						directReference: true,
						topicContinuation: true,
						contextualDependency: true,
						informationValue: 8,
					},
				},
			]; // Missing score for turn 2

			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 1,
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should still work, treating missing scores as 0
			expect(result).toBeDefined();
			expect(result.length).toBeGreaterThan(0);
		});

		it("should handle recentCount larger than turns array", () => {
			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Turn 1",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			const mockScores: RelevanceScore[] = [
				{
					turnIndex: 0,
					score: 5,
					reason: "Test",
					categories: {
						directReference: false,
						topicContinuation: true,
						contextualDependency: false,
						informationValue: 5,
					},
				},
			];

			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 10, // More than available
					currentRecommendations: false,
				},
				relevanceThreshold: 10,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			// Should return all available turns
			expect(result).toHaveLength(1);
			expect(result[0]).toEqual(mockTurns[0]);
		});
	});

	describe("Type Safety", () => {
		it("should accept valid selection strategy", () => {
			const mockTurns: ConversationTurn[] = [
				{
					userMessage: "Test",
					botResponse: "Response",
					extractedEntities: {},
					timestamp: new Date(),
				},
			];

			const mockScores: RelevanceScore[] = [
				{
					turnIndex: 0,
					score: 8,
					reason: "Test",
					categories: {
						directReference: true,
						topicContinuation: true,
						contextualDependency: true,
						informationValue: 8,
					},
				},
			];

			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 1,
					currentRecommendations: false,
				},
				relevanceThreshold: 5.0,
				maxTurns: 10,
				tokenBudget: 10000,
			};

			const result: ConversationTurn[] = selector.selectOptimalTurns(
				mockTurns,
				mockScores,
				strategy
			);

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);
		});
	});
});
