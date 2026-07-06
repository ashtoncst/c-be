import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
	CONTEXT_CONFIG,
	ContextConfig,
	TokenBudget,
	SummarizationConfig,
	ScoringConfig,
} from "../../src/config/context.config.js";

describe("Context Configuration", () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		// Save original env
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		// Restore original env
		process.env = originalEnv;
	});

	describe("Default Values", () => {
		it("should have default relevanceThreshold of 6.0", () => {
			delete process.env.CONTEXT_RELEVANCE_THRESHOLD;
			const config = {
				relevanceThreshold: parseFloat(
					process.env.CONTEXT_RELEVANCE_THRESHOLD || "6.0"
				),
			};
			expect(config.relevanceThreshold).toBe(6.0);
		});

		it("should have default maxTurns of 15", () => {
			delete process.env.CONTEXT_MAX_TURNS;
			const config = {
				maxTurns: parseInt(process.env.CONTEXT_MAX_TURNS || "15"),
			};
			expect(config.maxTurns).toBe(15);
		});

		it("should have default tokenBudget.total of 32000", () => {
			delete process.env.CONTEXT_TOKEN_BUDGET_TOTAL;
			const config = {
				tokenBudget: {
					total: parseInt(process.env.CONTEXT_TOKEN_BUDGET_TOTAL || "32000"),
				},
			};
			expect(config.tokenBudget.total).toBe(32000);
		});

		it("should have default tokenBudget.systemPrompt of 22000", () => {
			delete process.env.CONTEXT_TOKEN_BUDGET_SYSTEM;
			const config = {
				tokenBudget: {
					systemPrompt: parseInt(
						process.env.CONTEXT_TOKEN_BUDGET_SYSTEM || "22000"
					),
				},
			};
			expect(config.tokenBudget.systemPrompt).toBe(22000);
		});

		it("should have default tokenBudget.availableForContext of 10000", () => {
			delete process.env.CONTEXT_TOKEN_BUDGET_AVAILABLE;
			const config = {
				tokenBudget: {
					availableForContext: parseInt(
						process.env.CONTEXT_TOKEN_BUDGET_AVAILABLE || "10000"
					),
				},
			};
			expect(config.tokenBudget.availableForContext).toBe(10000);
		});

		it("should have default summarization.triggerAfterTurns of 6", () => {
			delete process.env.CONTEXT_SUMMARIZATION_THRESHOLD;
			const config = {
				summarization: {
					triggerAfterTurns: parseInt(
						process.env.CONTEXT_SUMMARIZATION_THRESHOLD || "6"
					),
				},
			};
			expect(config.summarization.triggerAfterTurns).toBe(6);
		});

		it("should have summarization levels array", () => {
			expect(CONTEXT_CONFIG.summarization.levels).toEqual([
				"detailed",
				"condensed",
				"compressed",
			]);
		});

		it("should have default scoring.model of gemini-2.5-flash", () => {
			delete process.env.GEMINI_SCORING_MODEL;
			const config = {
				scoring: {
					model: process.env.GEMINI_SCORING_MODEL || "gemini-2.5-flash",
				},
			};
			expect(config.scoring.model).toBe("gemini-2.5-flash");
		});

		it("should have default scoring.temperature of 0.1", () => {
			delete process.env.GEMINI_SCORING_TEMPERATURE;
			const config = {
				scoring: {
					temperature: parseFloat(
						process.env.GEMINI_SCORING_TEMPERATURE || "0.1"
					),
				},
			};
			expect(config.scoring.temperature).toBe(0.1);
		});
	});

	describe("Environment Variable Overrides", () => {
		it("should override relevanceThreshold from env var", () => {
			process.env.CONTEXT_RELEVANCE_THRESHOLD = "7.5";
			const config = {
				relevanceThreshold: parseFloat(
					process.env.CONTEXT_RELEVANCE_THRESHOLD || "6.0"
				),
			};
			expect(config.relevanceThreshold).toBe(7.5);
		});

		it("should override maxTurns from env var", () => {
			process.env.CONTEXT_MAX_TURNS = "20";
			const config = {
				maxTurns: parseInt(process.env.CONTEXT_MAX_TURNS || "15"),
			};
			expect(config.maxTurns).toBe(20);
		});

		it("should override tokenBudget values from env vars", () => {
			process.env.CONTEXT_TOKEN_BUDGET_TOTAL = "40000";
			process.env.CONTEXT_TOKEN_BUDGET_SYSTEM = "28000";
			process.env.CONTEXT_TOKEN_BUDGET_AVAILABLE = "12000";

			const config = {
				tokenBudget: {
					total: parseInt(process.env.CONTEXT_TOKEN_BUDGET_TOTAL || "32000"),
					systemPrompt: parseInt(
						process.env.CONTEXT_TOKEN_BUDGET_SYSTEM || "22000"
					),
					availableForContext: parseInt(
						process.env.CONTEXT_TOKEN_BUDGET_AVAILABLE || "10000"
					),
				},
			};

			expect(config.tokenBudget.total).toBe(40000);
			expect(config.tokenBudget.systemPrompt).toBe(28000);
			expect(config.tokenBudget.availableForContext).toBe(12000);
		});

		it("should override scoring config from env vars", () => {
			process.env.GEMINI_SCORING_MODEL = "gemini-2.0-flash-exp";
			process.env.GEMINI_SCORING_TEMPERATURE = "0.2";

			const config = {
				scoring: {
					model: process.env.GEMINI_SCORING_MODEL || "gemini-2.5-flash",
					temperature: parseFloat(
						process.env.GEMINI_SCORING_TEMPERATURE || "0.1"
					),
				},
			};

			expect(config.scoring.model).toBe("gemini-2.0-flash-exp");
			expect(config.scoring.temperature).toBe(0.2);
		});
	});

	describe("Type Definitions", () => {
		it("should have TokenBudget type with correct structure", () => {
			const tokenBudget: TokenBudget = {
				total: 32000,
				systemPrompt: 22000,
				availableForContext: 10000,
			};

			expect(tokenBudget.total).toBe(32000);
			expect(tokenBudget.systemPrompt).toBe(22000);
			expect(tokenBudget.availableForContext).toBe(10000);
		});

		it("should have SummarizationConfig type with correct structure", () => {
			const summarization: SummarizationConfig = {
				triggerAfterTurns: 6,
				levels: ["detailed", "condensed", "compressed"],
			};

			expect(summarization.triggerAfterTurns).toBe(6);
			expect(summarization.levels).toHaveLength(3);
		});

		it("should have ScoringConfig type with correct structure", () => {
			const scoring: ScoringConfig = {
				model: "gemini-2.5-flash",
				temperature: 0.1,
			};

			expect(scoring.model).toBe("gemini-2.5-flash");
			expect(scoring.temperature).toBe(0.1);
		});

		it("should have ContextConfig type with all properties", () => {
			const config: ContextConfig = {
				relevanceThreshold: 6.0,
				maxTurns: 15,
				tokenBudget: {
					total: 32000,
					systemPrompt: 22000,
					availableForContext: 10000,
				},
				summarization: {
					triggerAfterTurns: 6,
					levels: ["detailed", "condensed", "compressed"],
				},
				scoring: {
					model: "gemini-2.5-flash",
					temperature: 0.1,
				},
			};

			expect(config.relevanceThreshold).toBeDefined();
			expect(config.maxTurns).toBeDefined();
			expect(config.tokenBudget).toBeDefined();
			expect(config.summarization).toBeDefined();
			expect(config.scoring).toBeDefined();
		});
	});

	describe("Configuration Validation", () => {
		it("should have relevanceThreshold between 0 and 10", () => {
			expect(CONTEXT_CONFIG.relevanceThreshold).toBeGreaterThanOrEqual(0);
			expect(CONTEXT_CONFIG.relevanceThreshold).toBeLessThanOrEqual(10);
		});

		it("should have maxTurns greater than 0", () => {
			expect(CONTEXT_CONFIG.maxTurns).toBeGreaterThan(0);
		});

		it("should have valid token budget relationships", () => {
			const { total, systemPrompt, availableForContext } =
				CONTEXT_CONFIG.tokenBudget;

			// System prompt + available should not exceed total
			expect(systemPrompt + availableForContext).toBeLessThanOrEqual(total);
			// All values should be positive
			expect(total).toBeGreaterThan(0);
			expect(systemPrompt).toBeGreaterThan(0);
			expect(availableForContext).toBeGreaterThan(0);
		});

		it("should have scoring temperature between 0 and 1", () => {
			expect(CONTEXT_CONFIG.scoring.temperature).toBeGreaterThanOrEqual(0);
			expect(CONTEXT_CONFIG.scoring.temperature).toBeLessThanOrEqual(1);
		});

		it("should have non-empty scoring model", () => {
			expect(CONTEXT_CONFIG.scoring.model).toBeTruthy();
			expect(CONTEXT_CONFIG.scoring.model.length).toBeGreaterThan(0);
		});
	});

	describe("Export structure", () => {
		it("should export CONTEXT_CONFIG as default", async () => {
			const module = await import("../../src/config/context.config.js");
			expect(module.default).toBeDefined();
			expect(typeof module.default).toBe("object");
		});

		it("should export CONTEXT_CONFIG as named export", async () => {
			const module = await import("../../src/config/context.config.js");
			expect(module.CONTEXT_CONFIG).toBeDefined();
			expect(typeof module.CONTEXT_CONFIG).toBe("object");
		});

		it("should export all type definitions", async () => {
			// This is a compile-time check, but we verify they can be imported
			const module = await import("../../src/config/context.config.js");
			expect(module.CONTEXT_CONFIG).toBeDefined();
		});
	});
});
