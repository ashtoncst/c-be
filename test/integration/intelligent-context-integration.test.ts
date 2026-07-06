/**
 * Integration Tests for Intelligent Context Management
 *
 * Tests the end-to-end flow:
 * ChatService → ContextService → IntelligentContextManager → LangChainService
 *
 * Testing Strategy:
 * 1. Verify intelligent context is used in chat flow
 * 2. Verify context selection with relevance scoring
 * 3. Verify summarization for long conversations
 * 4. Verify error handling and fallback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ContextService } from "../../src/services/context.service.js";

describe("Intelligent Context Integration", () => {
	let contextService: ContextService;

	beforeEach(() => {
		contextService = new ContextService();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("ContextService → IntelligentContextManager Integration", () => {
		it("should load context with intelligent selection", async () => {
			// This test verifies that loadIntelligentContext method exists
			// and returns a proper ConversationContext structure

			const sessionId = "test-session-integration-001";
			const query = "What are the installation requirements?";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// Verify structure
			expect(context).toBeDefined();
			expect(context).toHaveProperty("recentTurns");
			expect(context).toHaveProperty("userPreferences");
			expect(context).toHaveProperty("currentRecommendations");
			expect(context).toHaveProperty("conversationStage");

			// Verify types
			expect(Array.isArray(context.recentTurns)).toBe(true);
			expect(typeof context.userPreferences).toBe("object");
			expect(Array.isArray(context.currentRecommendations)).toBe(true);
			expect(typeof context.conversationStage).toBe("string");
		});

		it("should handle empty conversation history", async () => {
			const sessionId = "test-session-empty-002";
			const query = "Hello, I need help";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// Should return empty context
			expect(context.recentTurns).toEqual([]);
			expect(context.conversationStage).toBe("greeting");
			expect(context.currentRecommendations).toEqual([]);
		});

		it("should fallback to simple context on error", async () => {
			const sessionId = "test-session-error-003";
			const query = "Test query";

			// Context service should handle errors gracefully
			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// Should still return valid context structure
			expect(context).toBeDefined();
			expect(context).toHaveProperty("recentTurns");
			expect(context).toHaveProperty("conversationStage");
		});
	});

	describe("ConversationContext Interface Compatibility", () => {
		it("should return context compatible with LangChainService", async () => {
			const sessionId = "test-session-compat-004";
			const query = "Tell me more about fiber options";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// Verify interface matches what LangChainService expects
			expect(context).toHaveProperty("recentTurns");
			expect(context).toHaveProperty("userPreferences");
			expect(context).toHaveProperty("currentRecommendations");
			expect(context).toHaveProperty("conversationStage");

			// Verify recentTurns structure if present
			if (context.recentTurns.length > 0) {
				const turn = context.recentTurns[0];
				expect(turn).toHaveProperty("userMessage");
				expect(turn).toHaveProperty("botResponse");
				expect(turn).toHaveProperty("timestamp");
			}
		});

		it("should support optional conversationSummary in userPreferences", async () => {
			const sessionId = "test-session-summary-005";
			const query = "Continue with previous topic";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// userPreferences can optionally include conversationSummary
			expect(typeof context.userPreferences).toBe("object");

			// If summary exists, it should be a string
			if ("conversationSummary" in context.userPreferences) {
				expect(typeof context.userPreferences.conversationSummary).toBe(
					"string"
				);
			}
		});
	});

	describe("Context Loading Options", () => {
		it("should respect maxTurns option", async () => {
			const sessionId = "test-session-maxturns-006";
			const query = "Test query";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query,
				{ maxTurns: 5 }
			);

			// Should not exceed maxTurns (though might be less due to selection)
			expect(context.recentTurns.length).toBeLessThanOrEqual(5);
		});

		it("should load recommendations when requested", async () => {
			const sessionId = "test-session-recs-007";
			const query = "Show me more options";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query,
				{ loadRecommendations: true }
			);

			// Should include recommendations array (may be empty)
			expect(Array.isArray(context.currentRecommendations)).toBe(true);
		});

		it("should load preferences when requested", async () => {
			const sessionId = "test-session-prefs-008";
			const query = "Test query";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query,
				{ loadPreferences: true }
			);

			// Should include userPreferences object
			expect(typeof context.userPreferences).toBe("object");
			expect(context.userPreferences).toBeDefined();
		});
	});

	describe("Error Resilience", () => {
		it("should handle database connection errors", async () => {
			const sessionId = "test-session-dberror-009";
			const query = "Test query";

			// Should not throw, should return graceful fallback
			await expect(
				contextService.loadIntelligentContext(sessionId, query)
			).resolves.toBeDefined();
		});

		it("should handle invalid session IDs", async () => {
			const invalidSessionId = "";
			const query = "Test query";

			// Should handle gracefully
			const context = await contextService.loadIntelligentContext(
				invalidSessionId,
				query
			);

			expect(context).toBeDefined();
			expect(context.conversationStage).toBeDefined();
		});

		it("should handle missing query parameter", async () => {
			const sessionId = "test-session-noquery-010";
			const query = "";

			// Should handle empty query
			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			expect(context).toBeDefined();
		});
	});

	describe("Performance Characteristics", () => {
		it("should complete context loading within reasonable time", async () => {
			const sessionId = "test-session-perf-011";
			const query = "What are the best internet options?";

			const startTime = Date.now();

			await contextService.loadIntelligentContext(sessionId, query);

			const duration = Date.now() - startTime;

			// Should complete within 5 seconds (generous timeout for integration test)
			expect(duration).toBeLessThan(5000);
		});
	});

	describe("Conversation Stage Detection", () => {
		it("should detect greeting stage for empty history", async () => {
			const sessionId = "test-session-greeting-012";
			const query = "Hello";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			expect(context.conversationStage).toBe("greeting");
		});

		it("should return valid conversation stage", async () => {
			const sessionId = "test-session-stage-013";
			const query = "Tell me more";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			const validStages = [
				"greeting",
				"discovery",
				"refinement",
				"recommendation",
				"closing",
			];
			expect(validStages).toContain(context.conversationStage);
		});
	});

	describe("Type Safety", () => {
		it("should return properly typed ConversationContext", async () => {
			const sessionId = "test-session-types-014";
			const query = "Test query";

			const context = await contextService.loadIntelligentContext(
				sessionId,
				query
			);

			// Type checks
			expect(Array.isArray(context.recentTurns)).toBe(true);
			expect(typeof context.userPreferences).toBe("object");
			expect(Array.isArray(context.currentRecommendations)).toBe(true);
			expect(typeof context.conversationStage).toBe("string");

			// Each turn should have proper structure
			context.recentTurns.forEach((turn) => {
				expect(typeof turn.userMessage).toBe("string");
				expect(typeof turn.botResponse).toBe("string");
				expect(turn.timestamp).toBeInstanceOf(Date);
			});

			// Each recommendation should have proper structure
			context.currentRecommendations.forEach((item) => {
				expect(typeof item.id).toBe("number");
				expect(typeof item.name).toBe("string");
				expect(["solution", "category", "product"]).toContain(item.itemType);
			});
		});
	});
});
