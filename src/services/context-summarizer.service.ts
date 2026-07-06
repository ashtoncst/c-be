/**
 * Context Summarizer Service
 *
 * Uses Google Gemini to create concise summaries of conversation history.
 *
 * Features:
 * - Three summarization levels: detailed, condensed, compressed
 * - Fact extraction from conversations
 * - Progressive summarization (recent full, mid condensed, old compressed)
 * - Preserves key business facts and decisions
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { ConversationTurn } from "../dtos/chat.dto.js";
import type {
  SummarizationLevel,
  ConversationFacts,
  ProgressiveSummary,
} from "../types/intelligent-context.types.js";
import { CONTEXT_CONFIG } from "../config/context.config.js";

/**
 * Interface for Gemini fact extraction response
 */
interface GeminiFacts {
  industry?: string;
  businessSize?: string;
  budget?: string;
  requirements?: string[];
  decisions?: {
    accepted?: string[];
    rejected?: string[];
  };
}

export class ContextSummarizer {
  private geminiClient: ChatGoogleGenerativeAI;

  constructor(geminiClient?: ChatGoogleGenerativeAI) {
    // Allow injection for testing, otherwise create default client
    this.geminiClient =
      geminiClient ||
      new ChatGoogleGenerativeAI({
        model: CONTEXT_CONFIG.scoring.model,
        temperature: CONTEXT_CONFIG.scoring.temperature,
        apiKey: process.env.GOOGLE_GEMINI_API_KEY, // Required for AWS ECS deployment
      });
  }

  /**
   * Summarize conversation turns at specified detail level
   *
   * @param turns - Conversation turns to summarize
   * @param level - Summarization level (detailed/condensed/compressed)
   * @returns Summary text
   */
  async summarizeTurns(
    turns: ConversationTurn[],
    level: SummarizationLevel
  ): Promise<string> {
    if (turns.length === 0) {
      return "";
    }

    try {
      const prompt = this.buildSummarizationPrompt(turns, level);
      const response = await this.geminiClient.invoke(prompt);

      // Extract content from response
      if (
        typeof response === "object" &&
        response !== null &&
        "content" in response
      ) {
        return String((response as { content: unknown }).content).trim();
      }

      return this.getFallbackSummary(turns, level);
    } catch (error) {
      console.error(`[ContextSummarizer] Error summarizing turns:`, error);
      return this.getFallbackSummary(turns, level);
    }
  }

  /**
   * Extract structured facts from conversation turns
   *
   * @param turns - Conversation turns to analyze
   * @returns Extracted facts
   */
  async extractFacts(turns: ConversationTurn[]): Promise<ConversationFacts> {
    if (turns.length === 0) {
      return this.getEmptyFacts();
    }

    try {
      const prompt = this.buildFactExtractionPrompt(turns);
      const response = await this.geminiClient.invoke(prompt);

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

      // Parse JSON response
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned) as GeminiFacts;

      return {
        industry: parsed.industry,
        businessSize: parsed.businessSize,
        budget: parsed.budget,
        requirements: parsed.requirements || [],
        decisions: {
          accepted: parsed.decisions?.accepted || [],
          rejected: parsed.decisions?.rejected || [],
        },
      };
    } catch (error) {
      console.error(`[ContextSummarizer] Error extracting facts:`, error);
      return this.getEmptyFacts();
    }
  }

  /**
   * Create progressive summary with multiple detail levels
   *
   * @param recentTurns - Most recent turns (kept in full detail)
   * @param midRangeTurns - Mid-range turns (condensed summary)
   * @param olderTurns - Older turns (compressed summary)
   * @returns Progressive summary structure
   */
  async createProgressiveSummary(
    recentTurns: ConversationTurn[],
    midRangeTurns: ConversationTurn[],
    olderTurns: ConversationTurn[]
  ): Promise<ProgressiveSummary> {
    const summary: ProgressiveSummary = {
      detailed: recentTurns,
    };

    // Summarize mid-range turns if present
    if (midRangeTurns.length > 0) {
      try {
        summary.condensed = await this.summarizeTurns(
          midRangeTurns,
          "condensed"
        );
      } catch (error) {
        console.error(
          "[ContextSummarizer] Error creating condensed summary:",
          error
        );
        // Leave condensed as undefined on error
      }
    }

    // Summarize older turns if present
    if (olderTurns.length > 0) {
      try {
        summary.compressed = await this.summarizeTurns(
          olderTurns,
          "compressed"
        );
      } catch (error) {
        console.error(
          "[ContextSummarizer] Error creating compressed summary:",
          error
        );
        // Leave compressed as undefined on error
      }
    }

    return summary;
  }

  /**
   * Build summarization prompt for Gemini
   */
  private buildSummarizationPrompt(
    turns: ConversationTurn[],
    level: SummarizationLevel
  ): string {
    const levelInstructions = {
      detailed: "2-3 sentences preserving key details and product names",
      condensed: "1-2 sentences extracting main facts",
      compressed: "1 sentence maximum with ultra-brief background",
    };

    const conversationText = turns
      .map(
        (turn, idx) =>
          `Turn ${idx + 1}:\nUser: ${turn.userMessage}\nAssistant: ${
            turn.botResponse
          }`
      )
      .join("\n\n");

    return `You are summarizing a conversation about telecom product recommendations.

**Conversation to Summarize:**
${conversationText}

**Summarization Level:** ${level}
**Instructions:** Create a summary using ${levelInstructions[level]}.

**Focus on:**
- Industry/business type
- Key requirements mentioned
- Products recommended or discussed
- User decisions (accepted/rejected)
- Important business facts (size, budget, location)

**Output:** Provide ONLY the summary text, no preamble or explanation.`;
  }

  /**
   * Build fact extraction prompt for Gemini
   */
  private buildFactExtractionPrompt(turns: ConversationTurn[]): string {
    const conversationText = turns
      .map(
        (turn, idx) =>
          `Turn ${idx + 1}:\nUser: ${turn.userMessage}\nAssistant: ${
            turn.botResponse
          }`
      )
      .join("\n\n");

    return `You are extracting structured facts from a telecom sales conversation.

**Conversation:**
${conversationText}

**Task:** Extract key facts and decisions into structured JSON.

**Output Format (JSON only):**
{
  "industry": "<user's industry or business type>",
  "businessSize": "<number of rooms/employees/branches/etc>",
  "budget": "<budget indication if mentioned>",
  "requirements": ["<requirement 1>", "<requirement 2>", ...],
  "decisions": {
    "accepted": ["<products/solutions user accepted>"],
    "rejected": ["<products/solutions user rejected>"]
  }
}

**Instructions:**
- Only include fields where information is explicitly stated
- Requirements should be concise (e.g., "high-speed internet", "security cameras")
- Accepted = user said yes, agreed, or showed strong interest
- Rejected = user said no, not interested, or explicitly rejected

Provide ONLY the JSON object, no explanation.`;
  }

  /**
   * Get fallback summary when summarization fails
   */
  private getFallbackSummary(
    turns: ConversationTurn[],
    level: SummarizationLevel
  ): string {
    // Simple fallback: concatenate first user message and count of turns
    const firstMessage = turns[0]?.userMessage || "Customer inquiry";
    const turnCount = turns.length;

    const levelPrefix = {
      detailed: "Conversation about",
      condensed: "Discussed",
      compressed: "Topic:",
    };

    return `${levelPrefix[level]} ${firstMessage.slice(0, 50)}${
      firstMessage.length > 50 ? "..." : ""
    } (${turnCount} turns)`;
  }

  /**
   * Get empty facts structure
   */
  private getEmptyFacts(): ConversationFacts {
    return {
      requirements: [],
      decisions: {
        accepted: [],
        rejected: [],
      },
    };
  }
}
