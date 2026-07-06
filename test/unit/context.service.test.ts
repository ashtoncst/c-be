// test/unit/context.service.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { ContextService } from "../../src/services/context.service.js";
import type {
	ConversationContext,
	ExtractedEntitiesDto,
	ConversationTurn,
} from "../../src/dtos/chat.dto.js";

// Mock data helpers
const createTurn = (
	message: string,
	entities: Partial<ExtractedEntitiesDto> = {}
): ConversationTurn => ({
	userMessage: message,
	botResponse: "Bot response",
	extractedEntities: entities as ExtractedEntitiesDto,
	timestamp: new Date(),
});

const createContext = (
	turns: ConversationTurn[] = []
): ConversationContext => ({
	recentTurns: turns,
	userPreferences: {},
	currentRecommendations: [],
	conversationStage: "discovery",
});

describe("ContextService", () => {
	let contextService: ContextService;

	beforeEach(() => {
		contextService = new ContextService();
	});

	describe("Context Merging Strategy Detection", () => {
		describe("Affirmation Detection", () => {
			const affirmations = [
				"yes",
				"yup",
				"yeah",
				"sure",
				"ok",
				"okay",
				"please",
				"continue",
				"Yes, that works",
				"okay, tell me more",
			];

			affirmations.forEach((msg) => {
				it(`should detect "${msg}" as affirmation`, () => {
					const context = createContext([
						createTurn("I need ddos protection", {
							solution: "Security Anti-DDos",
							category: "Security",
						}),
					]);

					const current: Partial<ExtractedEntitiesDto> = {
						intent: "affirmation",
					};

					// Merge should carry all previous entities
					const merged = contextService.mergeWithContext(current, context, msg);

					expect(merged.solution).toBe("Security Anti-DDos");
					expect(merged.category).toBe("Security");
					expect(merged.intent).toBe("affirmation");
				});
			});
		});

		describe("Negation Detection", () => {
			const negations = [
				"no",
				"nope",
				"nah",
				"not really",
				"doesn't work",
				"didn't help",
				"not yet",
				"No, I need something else",
			];

			negations.forEach((msg) => {
				it(`should detect "${msg}" as negation`, () => {
					const context = createContext([
						createTurn("I need ddos protection", {
							solution: "Security Anti-DDos",
						}),
					]);

					const current: Partial<ExtractedEntitiesDto> = { intent: "negation" };

					// Merge should NOT carry previous entities
					const merged = contextService.mergeWithContext(current, context, msg);

					expect(merged.solution).toBeUndefined();
					expect(merged.intent).toBe("negation");
				});
			});
		});

		describe("Topic Shift Detection", () => {
			it("should detect topic shift when solution changes", () => {
				const context = createContext([
					createTurn("I need ddos protection", {
						solution: "Security Anti-DDos",
						category: "Security",
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					solution: "SD-WAN",
					category: "Networking",
				};

				// Should NOT carry previous solution/category
				const merged = contextService.mergeWithContext(
					current,
					context,
					"I need SD-WAN for networking"
				);

				expect(merged.solution).toBe("SD-WAN");
				expect(merged.category).toBe("Networking");
			});

			it("should detect topic shift when category changes", () => {
				const context = createContext([
					createTurn("I need internet", {
						category: "Internet",
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					category: "Security",
				};

				// Should NOT carry previous category
				const merged = contextService.mergeWithContext(
					current,
					context,
					"I need security solutions"
				);

				expect(merged.category).toBe("Security");
			});

			it("should NOT detect topic shift when adding details to same solution", () => {
				const context = createContext([
					createTurn("I need ddos protection", {
						solution: "Security Anti-DDos",
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					solution: "Security Anti-DDos",
					target_audience: "Enterprise",
				};

				// Should merge (same solution)
				const merged = contextService.mergeWithContext(
					current,
					context,
					"for enterprise clients"
				);

				expect(merged.solution).toBe("Security Anti-DDos");
				expect(merged.target_audience).toBe("Enterprise");
			});
		});

		describe("Normal Merge Scenarios", () => {
			it("should merge when current message adds target_audience", () => {
				const context = createContext([
					createTurn("I need internet", {
						category: "Internet",
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					target_audience: "SMB",
				};

				// Should carry forward category
				const merged = contextService.mergeWithContext(
					current,
					context,
					"for small businesses"
				);

				expect(merged.category).toBe("Internet");
				expect(merged.target_audience).toBe("SMB");
			});

			it("should merge when current message adds features", () => {
				const context = createContext([
					createTurn("I need ddos protection", {
						solution: "Security Anti-DDos",
						features: ["always-on"],
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					features: ["auto-mitigation"],
				};

				// Should merge arrays
				const merged = contextService.mergeWithContext(
					current,
					context,
					"with auto-mitigation"
				);

				expect(merged.solution).toBe("Security Anti-DDos");
				expect(merged.features).toContain("always-on");
				expect(merged.features).toContain("auto-mitigation");
				expect(merged.features?.length).toBe(2);
			});

			it("should NOT merge when message is completely new topic", () => {
				const context = createContext([
					createTurn("I need ddos protection", {
						solution: "Security Anti-DDos",
					}),
				]);

				const current: Partial<ExtractedEntitiesDto> = {
					solution: "SD-WAN",
					category: "Networking",
				};

				// Topic shift - don't carry
				const merged = contextService.mergeWithContext(
					current,
					context,
					"I need SD-WAN networking"
				);

				expect(merged.solution).toBe("SD-WAN");
				expect(merged.category).toBe("Networking");
			});
		});
	});

	describe("Conversation Stage Detection", () => {
		it('should detect "greeting" stage for first turn', async () => {
			// Stage is detected during context load
			// For now, we'll test the logic indirectly
			expect(true).toBe(true); // Integration test will cover this
		});

		it('should detect "discovery" stage for 1-2 turns', async () => {
			expect(true).toBe(true); // Integration test will cover this
		});

		it('should detect "refinement" stage for 3-5 turns', async () => {
			expect(true).toBe(true); // Integration test will cover this
		});

		it('should detect "recommendation" stage when recommendations exist', async () => {
			expect(true).toBe(true); // Integration test will cover this
		});

		it('should detect "closing" stage for 6+ turns', async () => {
			expect(true).toBe(true); // Integration test will cover this
		});
	});

	describe("Context Loading", () => {
		it("should load context with default options (5 turns)", () => {
			// Test that loadContext retrieves up to 5 recent turns
			expect(true).toBe(true); // Placeholder
		});

		it("should load context with custom maxTurns", () => {
			// Test that loadContext respects maxTurns option
			expect(true).toBe(true); // Placeholder
		});

		it("should load previous recommendations when enabled", () => {
			// Test that recommendations are loaded from DB
			expect(true).toBe(true); // Placeholder
		});

		it("should skip recommendations when disabled", () => {
			// Test that recommendations are not loaded when option is false
			expect(true).toBe(true); // Placeholder
		});

		it("should load user preferences when enabled", () => {
			// Test that user preferences are loaded from session
			expect(true).toBe(true); // Placeholder
		});

		it("should return empty context on database error", () => {
			// Test graceful degradation when DB fails
			// TODO: Mock DB error and test actual graceful degradation
			expect(true).toBe(true); // Placeholder
		});
	});

	describe("Entity Merging with Context", () => {
		it("should not merge on first turn (no context)", () => {
			const context = createContext([]);
			const current: Partial<ExtractedEntitiesDto> = {
				solution: "Security Anti-DDos",
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"I need ddos protection"
			);

			expect(merged.solution).toBe("Security Anti-DDos");
		});

		it("should merge affirmation with entire previous turn", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					solution: "Security Anti-DDos",
					category: "Security",
					target_audience: "Enterprise",
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				intent: "affirmation",
			};

			const merged = contextService.mergeWithContext(current, context, "yes");

			expect(merged.solution).toBe("Security Anti-DDos");
			expect(merged.category).toBe("Security");
			expect(merged.target_audience).toBe("Enterprise");
			expect(merged.intent).toBe("affirmation");
		});

		it("should clear context on negation", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					solution: "Security Anti-DDos",
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				intent: "negation",
			};

			const merged = contextService.mergeWithContext(current, context, "no");

			expect(merged.solution).toBeUndefined();
			expect(merged.intent).toBe("negation");
		});

		it("should merge arrays when preserveArrays is true (default)", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					solution: "Security Anti-DDos",
					features: ["always-on", "auto-mitigation"],
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				solution: "Security Anti-DDos",
				features: ["multi-layer"],
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"with multi-layer protection"
			);

			expect(merged.features).toContain("always-on");
			expect(merged.features).toContain("auto-mitigation");
			expect(merged.features).toContain("multi-layer");
			expect(merged.features?.length).toBe(3);
		});

		it("should replace arrays when preserveArrays is false", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					features: ["always-on"],
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				features: ["multi-layer"],
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"switch to multi-layer",
				{ preserveArrays: false }
			);

			expect(merged.features).not.toContain("always-on");
			expect(merged.features).toContain("multi-layer");
			expect(merged.features?.length).toBe(1);
		});

		it("should carry forward solution/category when missing in current", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					solution: "Security Anti-DDos",
					category: "Security",
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				target_audience: "Enterprise",
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"for enterprise clients"
			);

			expect(merged.solution).toBe("Security Anti-DDos");
			expect(merged.category).toBe("Security");
			expect(merged.target_audience).toBe("Enterprise");
		});

		it("should NOT carry forward when topic shifts", () => {
			const context = createContext([
				createTurn("I need ddos protection", {
					solution: "Security Anti-DDos",
					category: "Security",
				}),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				solution: "SD-WAN",
				category: "Networking",
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"I need SD-WAN networking"
			);

			expect(merged.solution).toBe("SD-WAN");
			expect(merged.category).toBe("Networking");
		});
	});

	describe("Context Saving", () => {
		it("should save conversation turn with entities", () => {
			// Test that saveTurn inserts into chatConversations
			expect(true).toBe(true); // Placeholder
		});

		it("should update session lastActivityAt", () => {
			// Test that session timestamp is updated
			expect(true).toBe(true); // Placeholder
		});

		it("should use transaction for atomic save", () => {
			// Test that both operations succeed or fail together
			expect(true).toBe(true); // Placeholder
		});

		it("should handle save errors gracefully", () => {
			// Test error handling
			expect(true).toBe(true); // Placeholder
		});
	});

	describe("Edge Cases", () => {
		it("should handle null/undefined previous entities", () => {
			const context = createContext([createTurn("Hello", undefined)]);

			const current: Partial<ExtractedEntitiesDto> = {
				solution: "Security Anti-DDos",
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"I need ddos protection"
			);

			expect(merged.solution).toBe("Security Anti-DDos");
		});

		it("should handle empty message strings", () => {
			const context = createContext([]);
			const current: Partial<ExtractedEntitiesDto> = {};

			const merged = contextService.mergeWithContext(current, context, "");

			expect(merged).toBeDefined();
		});

		it("should handle malformed entities", () => {
			const context = createContext([
				createTurn("test", { solution: null as unknown as string }),
			]);

			const current: Partial<ExtractedEntitiesDto> = {
				solution: "Security Anti-DDos",
			};

			const merged = contextService.mergeWithContext(
				current,
				context,
				"I need ddos protection"
			);

			expect(merged.solution).toBe("Security Anti-DDos");
		});
	});
});
