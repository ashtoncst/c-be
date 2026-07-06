/**
 * Intelligent Context Management Type Definitions
 *
 * Types for Gemini-based relevance scoring, context selection, and summarization.
 */

import type { ConversationTurn } from "../dtos/chat.dto.js";
import type { EnrichedItem } from "../dtos/chat.dto.js";

/**
 * Categories for relevance scoring analysis
 */
export interface RelevanceScoreCategories {
	/** Whether query explicitly references this turn ("as you mentioned") */
	directReference: boolean;
	/** Whether turn continues the same topic/solution */
	topicContinuation: boolean;
	/** Whether current answer depends on this turn's context */
	contextualDependency: boolean;
	/** How much unique information this turn provides (0-10) */
	informationValue: number;
}

/**
 * Relevance score for a conversation turn
 */
export interface RelevanceScore {
	/** Index of the turn in conversation history */
	turnIndex: number;
	/** Overall relevance score 0-10 (10 = highly relevant) */
	score: number;
	/** Explanation of why this score was assigned */
	reason: string;
	/** Detailed categorization of relevance */
	categories: RelevanceScoreCategories;
}

/**
 * Types of user queries for adaptive context selection
 */
export type QueryType =
	| "product_search" // User searching for products/solutions
	| "comparison" // User comparing options
	| "follow_up" // Asking about previous recommendations ("tell me more")
	| "new_topic" // Changing subject/solution category
	| "clarification"; // Asking for more details about a concept

/**
 * Strategy for selecting optimal conversation turns
 */
export interface SelectionStrategy {
	/** Turns to always include regardless of score */
	alwaysInclude: {
		/** Number of most recent turns to always include */
		recentCount: number;
		/** Whether to always include current recommendations */
		currentRecommendations: boolean;
	};
	/** Minimum relevance score (0-10) to include a turn */
	relevanceThreshold: number;
	/** Maximum total turns to include */
	maxTurns: number;
	/** Maximum tokens allocated for context */
	tokenBudget: number;
}

/**
 * Options for intelligent context selection
 */
export interface IntelligentContextOptions {
	/** Current user query */
	query: string;
	/** All available conversation turns */
	allTurns: ConversationTurn[];
	/** User preferences and profile */
	userPreferences: Record<string, unknown>;
	/** Currently recommended items */
	currentRecommendations: EnrichedItem[];
}

/**
 * Summarization detail levels
 */
export type SummarizationLevel =
	| "detailed" // Preserve key details and product names (2-3 sentences)
	| "condensed" // Extract main facts (1-2 sentences)
	| "compressed"; // Ultra-brief background (1 sentence max)

/**
 * Extracted facts from conversation for summarization
 */
export interface ConversationFacts {
	/** User's industry or business type */
	industry?: string;
	/** Business size (rooms, employees, branches, etc.) */
	businessSize?: string;
	/** Budget indication */
	budget?: string;
	/** Key requirements mentioned */
	requirements: string[];
	/** User decisions on recommendations */
	decisions: {
		/** Products/solutions accepted */
		accepted: string[];
		/** Products/solutions rejected */
		rejected: string[];
	};
}

/**
 * Progressive summarization result
 */
export interface ProgressiveSummary {
	/** Most recent turns (full detail) */
	detailed: ConversationTurn[];
	/** Mid-range turns (condensed summary) */
	condensed?: string;
	/** Older turns (compressed summary) */
	compressed?: string;
}
