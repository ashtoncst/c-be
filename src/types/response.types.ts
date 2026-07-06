// src/types/response.types.ts

import type { MatchConfidence } from "./matching.types.js";

/**
 * Response template types
 */
export type ResponseTemplate =
	| "product_recommendation" // Standard product recommendations
	| "category_discovery" // List of categories to explore
	| "clarification_needed" // Ask for more information
	| "no_results" // No matches found
	| "follow_up"; // Follow-up question

/**
 * Follow-up question configuration
 */
export interface FollowUpConfig {
	field: string; // Missing field name
	question: string; // Question to ask
	priority: number; // Priority (1 = highest)
}

/**
 * Smart question templates for missing fields
 */
export const FOLLOW_UP_QUESTIONS: Record<string, FollowUpConfig> = {
	solution: {
		field: "solution",
		question: "What type of solution are you looking for?",
		priority: 1,
	},
	category: {
		field: "category",
		question:
			"Which category would you like to explore? (e.g., Security, Internet, Networking)",
		priority: 2,
	},
	target_audience: {
		field: "target_audience",
		question: "Is this for a small business, enterprise, or residential use?",
		priority: 3,
	},
	features: {
		field: "features",
		question: "Are there any specific features you're looking for?",
		priority: 4,
	},
	budget: {
		field: "budget",
		question: "Do you have a specific budget range in mind?",
		priority: 5,
	},
};

/**
 * Response generation options
 */
export interface ResponseGenerationOptions {
	includeNarrative?: boolean; // Generate AI narrative (default: true)
	includeFollowUp?: boolean; // Add follow-up questions (default: true)
	maxItems?: number; // Max items to include in response (default: 5)
	conversationStage?: string; // Current conversation stage
}

/**
 * Response metadata for debugging
 */
export interface ResponseMetadata {
	template: ResponseTemplate;
	confidence: MatchConfidence;
	itemCount: number;
	includesFollowUp: boolean;
	generationTime: number; // milliseconds
}
