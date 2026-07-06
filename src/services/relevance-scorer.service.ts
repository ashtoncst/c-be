/**
 * RelevanceScorer Service
 *
 * Uses Google Gemini to score the relevance of past conversation turns
 * to the current user query.
 *
 * Features:
 * - Semantic relevance scoring (0-10 scale)
 * - Category-based scoring (direct reference, topic continuation, etc.)
 * - Batch processing with parallel execution
 * - In-memory caching to reduce API calls
 * - Fallback handling for API errors
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { ConversationTurn } from "../dtos/chat.dto.js";
import type {
  RelevanceScore,
  RelevanceScoreCategories,
} from "../types/intelligent-context.types.js";
import { CONTEXT_CONFIG } from "../config/context.config.js";

/**
 * Interface for parsed response from Gemini
 */
interface GeminiRelevanceResponse {
  score: number;
  reason: string;
  directReference?: boolean;
  topicContinuation?: boolean;
  contextualDependency?: boolean;
  informationValue?: number;
}

export class RelevanceScorer {
  private geminiClient: ChatGoogleGenerativeAI;
  private cache: Map<string, RelevanceScore>;

  constructor(geminiClient?: ChatGoogleGenerativeAI) {
    // Allow injection for testing, otherwise create default client
    this.geminiClient =
      geminiClient ||
      new ChatGoogleGenerativeAI({
        model: CONTEXT_CONFIG.scoring.model,
        temperature: CONTEXT_CONFIG.scoring.temperature,
        apiKey: process.env.GOOGLE_GEMINI_API_KEY, // Required for AWS ECS deployment
      });

    this.cache = new Map();
  }

  /**
   * Score a single conversation turn's relevance to the current query
   */
  async scoreRelevance(
    query: string,
    turn: ConversationTurn,
    turnIndex: number
  ): Promise<RelevanceScore> {
    // Check cache first
    const cacheKey = this.buildCacheKey(query, turn, turnIndex);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const prompt = this.buildScoringPrompt(query, turn);
      const response = await this.geminiClient.invoke(prompt);

      const score = this.parseGeminiResponse(response, turnIndex);

      // Cache the result
      this.cache.set(cacheKey, score);

      return score;
    } catch (error) {
      console.error(
        `[RelevanceScorer] Error scoring turn ${turnIndex}:`,
        error
      );
      return this.getFallbackScore(turnIndex, "Error during scoring");
    }
  }

  /**
   * Score multiple conversation turns in parallel
   */
  async scoreBatch(
    query: string,
    turns: ConversationTurn[]
  ): Promise<RelevanceScore[]> {
    if (turns.length === 0) {
      return [];
    }

    // Process all turns in parallel
    const scoringPromises = turns.map((turn, index) =>
      this.scoreRelevance(query, turn, index)
    );

    return Promise.all(scoringPromises);
  }

  /**
   * Clear the relevance score cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Build the scoring prompt for Gemini
   */
  private buildScoringPrompt(query: string, turn: ConversationTurn): string {
    return `You are an expert at evaluating conversational relevance for an AI chatbot that recommends telecom products.

**Current User Query:**
"${query}"

**Previous Conversation Turn:**
User: "${turn.userMessage}"
Assistant: "${turn.botResponse}"

**Task:**
Score the relevance of this previous turn to the current query on a scale of 0-10.

**Scoring Guidelines:**
- 10: Directly answers or relates to current query (same topic, same products)
- 8-9: High relevance (related topic, provides context for current query)
- 6-7: Moderate relevance (useful background, related area)
- 4-5: Low relevance (tangentially related, might provide minor context)
- 2-3: Minimal relevance (different topic, minimal connection)
- 0-1: No relevance (completely unrelated)

**Category Indicators:**
- directReference: Does this turn directly reference entities in the current query?
- topicContinuation: Is this turn part of the same conversation topic/flow?
- contextualDependency: Does understanding the current query require this turn?
- informationValue (0-10): How much useful information does this turn provide?

**Output Format (JSON only):**
{
  "score": <number 0-10>,
  "reason": "<brief explanation>",
  "directReference": <boolean>,
  "topicContinuation": <boolean>,
  "contextualDependency": <boolean>,
  "informationValue": <number 0-10>
}`;
  }

  /**
   * Parse the response from Gemini
   */
  private parseGeminiResponse(
    response: { content: string } | unknown,
    turnIndex: number
  ): RelevanceScore {
    try {
      // Extract content from response
      let content: string;
      if (
        typeof response === "object" &&
        response !== null &&
        "content" in response
      ) {
        content = String((response as { content: unknown }).content);
      } else {
        throw new Error("Invalid response format");
      }

      // Try to parse as JSON
      let parsed: GeminiRelevanceResponse;
      try {
        // Remove markdown code blocks if present
        const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned) as GeminiRelevanceResponse;
      } catch (parseError) {
        // If JSON parsing fails, try to extract score from text
        const scoreMatch = /score["\s:]+(\d+(?:\.\d+)?)/i.exec(content);
        if (scoreMatch) {
          parsed = {
            score: parseFloat(scoreMatch[1]),
            reason: "Extracted from text response",
          };
        } else {
          throw parseError;
        }
      }

      // Validate and clamp score to 0-10 range
      const score = Math.max(0, Math.min(10, parsed.score || 0));

      // Build categories with defaults
      const categories: RelevanceScoreCategories = {
        directReference: parsed.directReference ?? false,
        topicContinuation: parsed.topicContinuation ?? false,
        contextualDependency: parsed.contextualDependency ?? false,
        informationValue: Math.max(
          0,
          Math.min(10, parsed.informationValue ?? score)
        ),
      };

      return {
        turnIndex,
        score,
        reason: parsed.reason || "No reason provided",
        categories,
      };
    } catch (error) {
      console.error("[RelevanceScorer] Error parsing Gemini response:", error);
      return this.getFallbackScore(turnIndex, "Error parsing response");
    }
  }

  /**
   * Get fallback score when scoring fails
   */
  private getFallbackScore(turnIndex: number, reason: string): RelevanceScore {
    // Use a moderate fallback score to be safe
    return {
      turnIndex,
      score: 5,
      reason: `Fallback score: ${reason}`,
      categories: {
        directReference: false,
        topicContinuation: false,
        contextualDependency: false,
        informationValue: 5,
      },
    };
  }

  /**
   * Build cache key for a query-turn pair
   */
  private buildCacheKey(
    query: string,
    turn: ConversationTurn,
    turnIndex: number
  ): string {
    // Create a simple hash-like key
    const turnKey = `${turn.userMessage}|${turn.botResponse}`;
    return `${query}::${turnIndex}::${turnKey}`;
  }
}
