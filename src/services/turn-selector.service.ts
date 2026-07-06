/**
 * Turn Selector Service
 *
 * Applies hybrid selection strategy to choose optimal conversation turns.
 *
 * Features:
 * - Recency-based selection (always include N most recent)
 * - Relevance-based selection (include if score >= threshold)
 * - Hybrid selection (union of both criteria)
 * - maxTurns enforcement
 * - Token budget awareness (for future enhancement)
 */

import type { ConversationTurn } from "../dtos/chat.dto.js";
import type {
	RelevanceScore,
	SelectionStrategy,
} from "../types/intelligent-context.types.js";

export class TurnSelector {
	/**
	 * Select optimal conversation turns based on strategy
	 *
	 * @param allTurns - All available conversation turns
	 * @param relevanceScores - Relevance scores for each turn
	 * @param strategy - Selection strategy
	 * @returns Selected turns in chronological order
	 */
	selectOptimalTurns(
		allTurns: ConversationTurn[],
		relevanceScores: RelevanceScore[],
		strategy: SelectionStrategy
	): ConversationTurn[] {
		if (allTurns.length === 0) {
			return [];
		}

		// Step 1: Identify indices to include based on recency
		const recentIndices = this.selectRecentIndices(
			allTurns,
			strategy.alwaysInclude.recentCount
		);

		// Step 2: Identify indices to include based on relevance
		const relevantIndices = this.selectRelevantIndices(
			relevanceScores,
			strategy.relevanceThreshold
		);

		// Step 3: Merge indices (union), ensuring no duplicates
		const selectedIndices = new Set([...recentIndices, ...relevantIndices]);

		// Step 4: Convert to array and sort chronologically
		const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);

		// Step 5: Enforce maxTurns limit
		const limitedIndices = this.enforceMaxTurns(
			sortedIndices,
			strategy.maxTurns,
			relevanceScores
		);

		// Step 6: Map indices to actual turns
		return limitedIndices.map((index) => allTurns[index]).filter(Boolean);
	}

	/**
	 * Select indices of N most recent turns
	 */
	private selectRecentIndices(
		allTurns: ConversationTurn[],
		recentCount: number
	): number[] {
		const totalTurns = allTurns.length;

		if (recentCount >= totalTurns) {
			// Include all turns
			return Array.from({ length: totalTurns }, (_, i) => i);
		}

		// Get indices of N most recent turns
		const startIndex = totalTurns - recentCount;
		return Array.from({ length: recentCount }, (_, i) => startIndex + i);
	}

	/**
	 * Select indices of turns above relevance threshold
	 */
	private selectRelevantIndices(
		relevanceScores: RelevanceScore[],
		threshold: number
	): number[] {
		return relevanceScores
			.filter((score) => score.score >= threshold)
			.map((score) => score.turnIndex);
	}

	/**
	 * Enforce maxTurns limit, prioritizing recent and high-scoring turns
	 */
	private enforceMaxTurns(
		selectedIndices: number[],
		maxTurns: number,
		relevanceScores: RelevanceScore[]
	): number[] {
		if (selectedIndices.length <= maxTurns) {
			return selectedIndices;
		}

		// Need to trim - prioritize by:
		// 1. Recency (newer turns more important)
		// 2. Relevance score (higher scores more important)

		// Create score map for quick lookup
		const scoreMap = new Map<number, number>();
		relevanceScores.forEach((score) => {
			scoreMap.set(score.turnIndex, score.score);
		});

		// Sort by composite score: recency weight + relevance weight
		const sorted = selectedIndices.sort((a, b) => {
			// Recency: higher index = more recent = higher priority
			const recencyA = a;
			const recencyB = b;

			// Relevance: higher score = higher priority
			const relevanceA = scoreMap.get(a) || 0;
			const relevanceB = scoreMap.get(b) || 0;

			// Composite score: 50% recency, 50% relevance
			// Normalize recency to 0-10 scale assuming max 100 turns
			const normalizedRecencyA = (recencyA / 100) * 10;
			const normalizedRecencyB = (recencyB / 100) * 10;

			const compositeA = normalizedRecencyA + relevanceA;
			const compositeB = normalizedRecencyB + relevanceB;

			// Higher composite score first
			return compositeB - compositeA;
		});

		// Take top maxTurns, then re-sort chronologically
		const trimmed = sorted.slice(0, maxTurns);
		return trimmed.sort((a, b) => a - b); // Chronological order
	}
}
