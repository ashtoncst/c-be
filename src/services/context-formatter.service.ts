// src/services/context-formatter.service.ts

/**
 * ContextFormatter: Message Formatting Based on Conversation Stage
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITIES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ Format conversation history differently per stage (greeting, discovery, feedback, etc.)
 * ✅ Prevent response accumulation (filters what Gemini sees)
 * ✅ Detect topic switches in user messages
 * ✅ Summarize responses to reduce token usage
 *
 * ❌ Does NOT determine conversation stage (handled by ContextSelector)
 * ❌ Does NOT select which turns to include (handled by ContextSelector)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STAGE-BASED FORMATTING:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * - greeting/discovery: No history (fresh start)
 * - refinement: Summarized entities only
 * - recommendation: Metadata without full responses (prevents regeneration)
 * - feedback: Simple list of previously recommended items
 * - closing: Same as feedback
 *
 * This prevents Gemini from seeing full previous responses and accidentally
 * regenerating them or accumulating responses across turns.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * // In LangChainService.generateRecommendationsFromCatalog():
 * const conversationMessages = this.contextFormatter.formatContextForState(
 *   context,  // Has conversationStage from ContextSelector
 *   message
 * );
 *
 * const messages = [
 *   { role: "system", content: systemPrompt },
 *   ...conversationMessages,  // Stage-formatted history
 *   { role: "user", content: message }
 * ];
 */

import type {
  ConversationContext,
  ExtractedEntitiesDto,
} from "../dtos/chat.dto.js";
import { Logger } from "../utils/logger.js";

export class ContextFormatter {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ serviceName: "ContextFormatter" });
  }

  /**
   * Format conversation history based on current state
   * Prevents response accumulation by providing only relevant context
   *
   * @param context - Full conversation context
   * @param currentMessage - Current user message
   * @returns Formatted messages for Gemini
   */
  formatContextForState(
    context: ConversationContext,
    currentMessage: string
  ): Array<{ role: string; content: string }> {
    const { conversationStage, recentTurns } = context;

    this.logger.debug("Formatting context for state", {
      stage: conversationStage,
      turnCount: recentTurns.length,
      messagePreview: currentMessage.substring(0, 50),
    });

    switch (conversationStage) {
      case "greeting":
        // No history for greetings
        return [];

      case "discovery":
        // First real query - no history needed (user is starting fresh)
        return [];

      case "refinement":
        // Clarification stage - summarize what we know
        return this.formatForClarification(context);

      case "recommendation":
        // Product recommendation - check for topic switch
        return this.formatForRecommendation(context, currentMessage);

      case "feedback":
        // Post-recommendation - include current recommendations
        return this.formatForFeedback(context);

      case "closing":
        // Closing stage - include current recommendations for final confirmation
        return this.formatForFeedback(context);

      default:
        // Fallback to recommendation formatting
        this.logger.warn(
          "Unknown conversation stage, using recommendation format",
          {
            stage: conversationStage,
          }
        );
        return this.formatForRecommendation(context, currentMessage);
    }
  }

  /**
   * Clarification state: surface extracted entities AND the products previously
   * recommended, so follow-ups like "Tell me more about that" have an anchor.
   */
  private formatForClarification(
    context: ConversationContext
  ): Array<{ role: string; content: string }> {
    if (context.recentTurns.length === 0 && context.currentRecommendations.length === 0) {
      return [];
    }

    const nonGreetingTurns = context.recentTurns.filter((turn) => {
      const isGreeting =
        turn.userMessage
          .toLowerCase()
          .match(
            /^(hi|hello|hey|good morning|good afternoon|good evening)[\s!?]*$/i
          ) ||
        turn.botResponse.includes("Hi there! How can I help you today?") ||
        turn.botResponse.includes(
          "Hello! I'm here to help you find the perfect ICT solutions"
        );

      return !isGreeting;
    });

    const lastTurn =
      nonGreetingTurns.length > 0
        ? nonGreetingTurns[nonGreetingTurns.length - 1]
        : null;
    const entities = lastTurn?.extractedEntities || {};

    const knownInfo: string[] = [];
    if (entities.target_audience)
      knownInfo.push(`Industry: ${entities.target_audience}`);
    if (entities.solution) knownInfo.push(`Interest: ${entities.solution}`);
    if (entities.category) knownInfo.push(`Category: ${entities.category}`);
    if (entities.num_users)
      knownInfo.push(`Scale: ${entities.num_users} users`);
    if (entities.primary_use && entities.primary_use.length > 0)
      knownInfo.push(`Use cases: ${entities.primary_use.join(", ")}`);

    const recommendedNames = context.currentRecommendations
      .map((item) => item.name)
      .filter((name): name is string => Boolean(name))
      .slice(0, 5);

    if (recommendedNames.length > 0) {
      knownInfo.push(
        `Previously recommended: ${recommendedNames.join(", ")}`
      );
    }

    if (knownInfo.length === 0) {
      this.logger.debug(
        "No entities or recommendations to surface, skipping clarification context"
      );
      return [];
    }

    this.logger.debug("Clarification context created", {
      knownInfo,
      recommendedCount: recommendedNames.length,
    });

    return [
      {
        role: "user",
        content: `[Context from previous conversation: ${knownInfo.join(
          "; "
        )}]`,
      },
    ];
  }

  /**
   * Recommendation state: Check for topic switch
   * Use when user has seen recommendations and is asking follow-up
   */
  private formatForRecommendation(
    context: ConversationContext,
    currentMessage: string
  ): Array<{ role: string; content: string }> {
    if (context.recentTurns.length === 0) return [];

    const nonGreetingTurns = context.recentTurns.filter((turn) => {
      const isGreeting =
        turn.userMessage
          .toLowerCase()
          .match(
            /^(hi|hello|hey|good morning|good afternoon|good evening)[\s!?]*$/i
          ) ||
        turn.botResponse.includes("Hi there! How can I help you today?") ||
        turn.botResponse.includes(
          "Hello! I'm here to help you find the perfect ICT solutions"
        );

      return !isGreeting;
    });

    if (nonGreetingTurns.length === 0) {
      this.logger.debug(
        "All turns were greetings, returning empty context"
      );
      return [];
    }

    // Use the last non-greeting turn for context
    const lastTurn = nonGreetingTurns[nonGreetingTurns.length - 1];
    const previousTopic = this.extractTopic(lastTurn.userMessage);
    const currentTopic = this.extractTopic(currentMessage);

    const isTopicSwitch =
      previousTopic !== currentTopic && currentTopic !== "General";

    this.logger.debug("Topic analysis", {
      previousMessage: lastTurn.userMessage,
      currentMessage,
      previousTopic,
      currentTopic,
      isTopicSwitch,
    });

    if (isTopicSwitch) {
      // Topic switch detected - clear previous context
      this.logger.info("Topic switch detected, clearing previous context", {
        from: previousTopic,
        to: currentTopic,
      });

      // Use empty array - topic switch means we don't need previous context
      // The system prompt already tells Gemini to focus on current message only
      return [];
    } else {
      // Topic continuation - provide context WITHOUT including previous assistant response
      const recommendedItems = context.currentRecommendations
        .map((item) => item.name)
        .slice(0, 5);

      // 🔥 CRITICAL FIX: DO NOT include previous assistant responses as messages!
      // Including assistant role messages causes Gemini to REGENERATE those responses
      // Instead, describe what happened using system context

      const entities = lastTurn.extractedEntities || {};
      const contextParts: string[] = [];

      // Build metadata about the conversation WITHOUT including the previous question or response text
      // 🔥 CRITICAL: Do NOT include lastTurn.userMessage - it causes Gemini to answer BOTH questions!
      // Only include WHAT was discussed (solution/products), not the original question

      if (entities.solution) {
        contextParts.push(
          `Previously discussed solution: ${entities.solution}`
        );
      }
      if (entities.category) {
        contextParts.push(`Category: ${entities.category}`);
      }
      if (recommendedItems.length > 0) {
        contextParts.push(
          `Products previously recommended: ${recommendedItems.join(", ")}`
        );
      }

      // Extract what options were mentioned WITHOUT including full text
      // Look for category names in the response (On-Premise Defense, Cloud Defenses, Hybrid Defenses)
      const mentionedOptions: string[] = [];
      const responseText = lastTurn.botResponse || "";

      // Check for security defense types
      if (responseText.includes("On-Premise Defense"))
        mentionedOptions.push("On-Premise Defense");
      if (responseText.includes("Cloud Defenses"))
        mentionedOptions.push("Cloud Defenses");
      if (responseText.includes("Hybrid Defenses"))
        mentionedOptions.push("Hybrid Defenses");

      // Check for other common categories
      if (responseText.includes("SD-WAN Basic"))
        mentionedOptions.push("SD-WAN Basic");
      if (responseText.includes("SD-WAN Premium"))
        mentionedOptions.push("SD-WAN Premium");
      if (responseText.includes("Fiber Broadband"))
        mentionedOptions.push("Fiber Broadband");
      if (responseText.includes("Fiber Dedicated"))
        mentionedOptions.push("Fiber Dedicated");

      if (mentionedOptions.length > 0) {
        contextParts.push(`Options mentioned: ${mentionedOptions.join(", ")}`);
      }

      const contextDescription = contextParts.join(". ");

      this.logger.info(
        "Providing conversation metadata (NO previous questions or responses)",
        {
          contextDescription,
          mentionedOptions,
        }
      );

      // Return metadata as user context - Gemini sees WHAT was discussed, not the full response
      // This prevents regeneration while maintaining context awareness
      // 🔥 FIX: Do NOT include currentMessage here - it's added separately in langchain.service.ts
      return [
        {
          role: "user",
          content: `[Previous conversation context: ${contextDescription}]`,
        },
      ];
    }
  }

  /**
   * Feedback state: Include current recommendations
   * Use when user is confirming or asking for alternatives after seeing recommendations
   */
  private formatForFeedback(
    context: ConversationContext
  ): Array<{ role: string; content: string }> {
    if (context.currentRecommendations.length === 0) {
      this.logger.debug(
        "No current recommendations, skipping feedback context"
      );
      return [];
    }

    // Extract solution and category from recent turns for context
    const lastTurn = context.recentTurns[context.recentTurns.length - 1];
    const solution = lastTurn?.extractedEntities?.solution;
    const category = lastTurn?.extractedEntities?.category;

    const recommendedItems = context.currentRecommendations
      .map((item) => item.name)
      .slice(0, 5)
      .join(", ");

    this.logger.debug("Feedback context created", {
      recommendationCount: context.currentRecommendations.length,
      solution,
      category,
    });

    // Format as context message showing what was previously recommended
    // Include solution/category to help Gemini stay focused
    let contextContent = `Previously recommended ${solution || "products"}`;
    if (category) {
      contextContent += ` in ${category} category`;
    }
    contextContent += `: ${recommendedItems}`;

    return [
      {
        role: "user",
        content: `[Context: ${contextContent}]`,
      },
    ];
  }

  /**
   * Extract topic from user message (solution or category)
   * Used for topic switch detection
   */
  private extractTopic(message: string): string {
    const lower = message.toLowerCase();

    // Solutions (top-level)
    if (
      lower.includes("internet") ||
      lower.includes("fiber") ||
      lower.includes("broadband") ||
      lower.includes("connectivity")
    ) {
      return "Internet";
    }
    if (lower.includes("satellite") || lower.includes("starlink")) {
      return "Satellite";
    }
    if (
      lower.includes("transport") ||
      lower.includes("vpn") ||
      lower.includes("wan") ||
      lower.includes("network")
    ) {
      return "Transport";
    }
    if (
      lower.includes("security") ||
      lower.includes("ddos") ||
      lower.includes("cybersecurity") ||
      lower.includes("anti-ddos")
    ) {
      return "Security";
    }
    if (lower.includes("managed")) {
      return "Managed Services";
    }
    if (
      lower.includes("content") ||
      lower.includes("iptv") ||
      lower.includes("tv")
    ) {
      return "Content";
    }
    if (
      lower.includes("colocation") ||
      lower.includes("data center") ||
      lower.includes("colo")
    ) {
      return "Colocation";
    }

    // Categories (mid-level, more specific)
    if (lower.includes("sd-wan") || lower.includes("sdwan")) {
      return "SD-WAN";
    }
    if (
      lower.includes("wifi") ||
      lower.includes("wi-fi") ||
      lower.includes("wireless")
    ) {
      return "Managed Wi-Fi";
    }
    if (lower.includes("draas") || lower.includes("disaster recovery")) {
      return "DraaS";
    }
    if (
      lower.includes("surveillance") ||
      lower.includes("camera") ||
      lower.includes("cctv")
    ) {
      return "Managed Surveillance";
    }
    if (lower.includes("metro ethernet")) {
      return "Metro Ethernet";
    }
    if (lower.includes("ip vpn")) {
      return "IP VPN";
    }

    // Fallback
    return "General";
  }

  /**
   * Summarize a bot response to prevent Gemini from regenerating it
   * Replaces full response text with concise summary
   *
   * @param userMessage - User's original message
   * @param botResponse - Full bot response text
   * @param recommendedItems - List of recommended item names
   * @returns Concise summary
   */
  summarizeResponse(
    userMessage: string,
    botResponse: string,
    recommendedItems: string[]
  ): string {
    // Extract key information
    const topic = this.extractTopic(userMessage);
    const itemList =
      recommendedItems.length > 0
        ? recommendedItems.join(", ")
        : "general information";

    // Create concise summary
    return `Previous: User asked about "${topic}". Showed: ${itemList}.`;
  }

  /**
   * Format conversation history with full summarization
   * Alternative approach: summarize ALL previous responses
   *
   * Use when you want maximum compression of history
   */
  formatConversationHistorySummarized(
    context: ConversationContext
  ): Array<{ role: string; content: string }> {
    if (context.recentTurns.length === 0) return [];

    const messages: Array<{ role: string; content: string }> = [];

    // Only include last 2 turns (to keep context window small)
    context.recentTurns.slice(-2).forEach((turn) => {
      // Include user message as-is
      messages.push({
        role: "user",
        content: turn.userMessage,
      });

      // Summarize bot response (don't include full text)
      const recommendedItems = context.currentRecommendations
        .map((item) => item.name)
        .slice(0, 5); // Top 5

      const summary = this.summarizeResponse(
        turn.userMessage,
        turn.botResponse,
        recommendedItems
      );

      messages.push({
        role: "assistant",
        content: summary, // 👈 SUMMARIZED, not full response
      });
    });

    this.logger.debug("Created summarized conversation history", {
      originalTurns: context.recentTurns.length,
      includedTurns: messages.length / 2,
    });

    return messages;
  }

  /**
   * Detect if current message is a clarification or new query
   * Helps determine if we should merge entities or start fresh
   *
   * @param currentMessage - Current user message
   * @param previousEntities - Entities from previous turn
   * @returns Whether this is a clarification
   */
  isClarification(
    currentMessage: string,
    previousEntities?: ExtractedEntitiesDto
  ): boolean {
    if (!previousEntities) return false;

    const lower = currentMessage.toLowerCase();

    // Check for clarification keywords
    const clarificationKeywords = [
      "for a", // "for a hotel"
      "with", // "with 50 rooms"
      "in the", // "in the hospitality industry"
      "about", // "about 100 employees"
      "around", // "around 20 users"
      "we are", // "we are a bank"
      "we have", // "we have 3 branches"
      "it's for", // "it's for our restaurant"
    ];

    const hasClarificationPattern = clarificationKeywords.some((keyword) =>
      lower.includes(keyword)
    );

    // Check if message adds to existing topic
    const previousTopic = this.extractTopicFromEntities(previousEntities);
    const currentTopic = this.extractTopic(currentMessage);

    const sameTopic =
      previousTopic === currentTopic || currentTopic === "General";

    this.logger.debug("Clarification detection", {
      hasClarificationPattern,
      sameTopic,
      previousTopic,
      currentTopic,
    });

    return hasClarificationPattern && sameTopic;
  }

  /**
   * Extract topic from entities
   */
  private extractTopicFromEntities(entities: ExtractedEntitiesDto): string {
    if (entities.solution) return entities.solution;
    if (entities.category) return entities.category;
    if (entities.product_category) return entities.product_category;
    return "General";
  }
}
