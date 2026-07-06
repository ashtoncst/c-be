/**
 * Context Management Configuration
 *
 * Configures intelligent context selection, token budgets, and summarization strategies.
 * All values can be overridden via environment variables for different deployment environments.
 */

/**
 * Token budget allocation for context management
 */
export interface TokenBudget {
	/** Total token limit for Gemini model (default: 32000 for gemini-2.5-flash) */
	total: number;
	/** Tokens allocated for system prompt including catalog (default: ~22000) */
	systemPrompt: number;
	/** Tokens available for conversation context (default: ~10000) */
	availableForContext: number;
}

/**
 * Summarization configuration
 */
export interface SummarizationConfig {
	/** Number of turns after which to trigger summarization (default: 6) */
	triggerAfterTurns: number;
	/** Summarization levels from most to least detailed */
	levels: readonly ["detailed", "condensed", "compressed"];
}

/**
 * Gemini scoring configuration
 */
export interface ScoringConfig {
	/** Gemini model to use for relevance scoring (default: gemini-2.5-flash) */
	model: string;
	/** Temperature for scoring consistency (default: 0.1 for deterministic) */
	temperature: number;
}

/**
 * Complete context configuration
 */
export interface ContextConfig {
	/** Minimum relevance score (0-10) required to include a turn (default: 6.0) */
	relevanceThreshold: number;
	/** Maximum number of turns to load for scoring (default: 15) */
	maxTurns: number;
	/** Token budget allocation */
	tokenBudget: TokenBudget;
	/** Summarization configuration */
	summarization: SummarizationConfig;
	/** Scoring configuration */
	scoring: ScoringConfig;
}

/**
 * Context configuration instance
 * Reads from environment variables with sensible defaults
 */
export const CONTEXT_CONFIG: ContextConfig = {
	relevanceThreshold: parseFloat(
		process.env.CONTEXT_RELEVANCE_THRESHOLD || "6.0"
	),
	maxTurns: parseInt(process.env.CONTEXT_MAX_TURNS || "15"),
	tokenBudget: {
		total: parseInt(process.env.CONTEXT_TOKEN_BUDGET_TOTAL || "32000"),
		systemPrompt: parseInt(process.env.CONTEXT_TOKEN_BUDGET_SYSTEM || "22000"),
		availableForContext: parseInt(
			process.env.CONTEXT_TOKEN_BUDGET_AVAILABLE || "10000"
		),
	},
	summarization: {
		triggerAfterTurns: parseInt(
			process.env.CONTEXT_SUMMARIZATION_THRESHOLD || "6"
		),
		levels: ["detailed", "condensed", "compressed"],
	},
	scoring: {
		model: process.env.GEMINI_SCORING_MODEL || "gemini-2.5-flash",
		temperature: parseFloat(process.env.GEMINI_SCORING_TEMPERATURE || "0.1"),
	},
};

export default CONTEXT_CONFIG;
