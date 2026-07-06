// src/types/matching.types.ts

import type { EnrichedItem } from "../dtos/chat.dto.js";

/**
 * Search mode determines the type of search to perform
 */
export type SearchMode =
	| "category_discovery" // Find categories when user has solution but no category
	| "product_search" // Find specific products
	| "clarification_needed"; // Not enough info to search

/**
 * Match result type
 */
export type MatchResultType =
	| "products" // Found specific products
	| "categories" // Found categories (for browsing)
	| "none"; // No matches or need clarification

/**
 * Confidence level for match results
 */
export type MatchConfidence = "high" | "medium" | "low";

/**
 * Match result with items and metadata
 */
export interface MatchResult {
	type: MatchResultType;
	items: EnrichedItem[];
	confidence: MatchConfidence;
	missing?: string[]; // Fields needed for better matching
	searchQuery?: string; // Query used for debugging
}

/**
 * Search query builder options
 */
export interface SearchQueryOptions {
	solution?: string;
	category?: string;
	productCategory?: string;
	targetAudience?: string;
	predictedProducts?: string[];
	features?: string[];
	maxResults?: number;
	excludeIds?: number[];
}

/**
 * Relevance scoring factors
 */
export interface RelevanceScores {
	nameMatch: number; // 0-1: Name similarity
	categoryMatch: number; // 0-1: Category match
	audienceMatch: number; // 0-1: Target audience match
	featureMatch: number; // 0-1: Feature overlap
	total: number; // Weighted sum
}

/**
 * Item with relevance score
 */
export interface ScoredItem {
	item: EnrichedItem;
	score: RelevanceScores;
}
