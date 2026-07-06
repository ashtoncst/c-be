// src/services/context.service.ts

/**
 * ContextService: Database Layer + Orchestration for Conversation Context
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITIES:
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ✅ Load conversation turns from database
 * ✅ Save conversation turns to database
 * ✅ Load user preferences and previous recommendations
 * ✅ Merge current entities with previous context
 * ✅ Orchestrate ContextSelector for smart context selection
 * 
 * ❌ Does NOT determine conversation stage (handled by ContextSelector)
 * ❌ Does NOT format messages for Gemini (handled by ContextFormatter)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * // In ChatService:
 * const context = await this.contextService.loadIntelligentContext(
 *   sessionId,
 *   userMessage,
 *   { maxTurns: 15, loadRecommendations: true }
 * );
 * 
 * // ContextSelector handles stage detection internally
 * // ContextFormatter formats messages based on that stage
 */

import { db } from "../db/index.js";
import { eq, desc, sql } from "drizzle-orm";
import { chatConversations, chatSessions } from "../models/schema.model.js";
import type {
  ConversationContext,
  ConversationTurn,
  ExtractedEntitiesDto,
  EnrichedItem,
  ChatRequestDto,
  ChatResponseDto,
} from "../dtos/chat.dto.js";
import type {
  ContextCarryDecision,
  MergeStrategy,
  ConversationStage,
  ContextLoadOptions,
  ContextMergeOptions,
} from "../types/context.types.js";
import { Logger } from "../utils/logger.js";
import { CatalogCacheService } from "./catalog-cache.service.js";
import { ContextSelector } from "./context-selector.service.js";

/**
 * ContextService: Centralized conversation context management
 *
 * Consolidates:
 * - loadConversationContext() from ChatService
 * - mergeWithPreviousEntities() from ChatService
 * - Context gating logic from context-gating.service
 * - determineConversationStage() logic
 * - Intelligent context selection using Gemini (NEW)
 *
 * Single responsibility: Manage conversation state and context merging
 */
export class ContextService {
  private logger: Logger;
  private contextSelector: ContextSelector;

  constructor() {
    this.logger = new Logger({ serviceName: "ContextService" });
    this.contextSelector = new ContextSelector();
  }

  /**
   * Count total conversation turns for a session.
   */
  async getConversationCount(sessionId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatConversations)
      .where(eq(chatConversations.sessionId, sessionId));
    return result[0]?.count ?? 0;
  }

  /**
   * Load complete conversation context for a session
   * Replaces: ChatService.loadConversationContext()
   *
   * @param sessionId - Session identifier
   * @param options - Context loading options
   * @returns Complete conversation context
   */
  async loadContext(
    sessionId: string,
    options: ContextLoadOptions = {}
  ): Promise<ConversationContext> {
    const {
      maxTurns = 5,
      loadRecommendations = true,
      loadPreferences = true,
    } = options;

    try {
      // Load recent conversation turns
      const turnRecords = await db
        .select({
          userMessage: chatConversations.userMessage,
          botResponse: chatConversations.botResponse,
          extractedEntities: chatConversations.extractedEntities,
          recommendedProducts: chatConversations.recommendedProducts,
          timestamp: chatConversations.createdAt,
        })
        .from(chatConversations)
        .where(eq(chatConversations.sessionId, sessionId))
        .orderBy(desc(chatConversations.createdAt))
        .limit(maxTurns);

      // Transform to ConversationTurn[]
      const recentTurns: ConversationTurn[] = turnRecords
        .reverse()
        .map((record) => ({
          userMessage: record.userMessage,
          botResponse: record.botResponse,
          extractedEntities:
            (record.extractedEntities as ExtractedEntitiesDto) || {},
          timestamp: record.timestamp || new Date(),
        }));

      // Load previous recommendations if requested
      let currentRecommendations: EnrichedItem[] = [];
      if (loadRecommendations && recentTurns.length > 0) {
        currentRecommendations = await this.loadPreviousRecommendations(
          sessionId,
          recentTurns
        );
      }

      // Load session preferences if requested
      let userPreferences: Record<string, unknown> = {};
      if (loadPreferences) {
        userPreferences = await this.loadUserPreferences(sessionId);
      }

      // ⚠️ Stage detection removed from ContextService
      // Stage is now determined by ContextSelector.selectContext()
      // For simple (non-intelligent) loading, default to discovery
      // This is a fallback path only - production uses loadIntelligentContext()
      const conversationStage: ConversationStage = "discovery";

      return {
        recentTurns,
        userPreferences,
        currentRecommendations,
        conversationStage,
      };
    } catch (error) {
      this.logger.error("Failed to load conversation context", error as Error);

      // Graceful degradation: return minimal context
      return {
        recentTurns: [],
        userPreferences: {},
        currentRecommendations: [],
        conversationStage: "greeting",
      };
    }
  }

  /**
   * Load context with intelligent selection (NEW)
   * Uses Gemini to score relevance and select optimal turns
   *
   * This method replaces simple chronological selection with intelligent
   * semantic relevance scoring and hybrid turn selection.
   *
   * @param sessionId - Session identifier
   * @param currentQuery - Current user query (for relevance scoring)
   * @param options - Context loading options
   * @returns Optimized conversation context
   */
  async loadIntelligentContext(
    sessionId: string,
    currentQuery: string,
    options: ContextLoadOptions = {}
  ): Promise<ConversationContext> {
    const {
      maxTurns = 15, // Increased from 5 to allow more selection
      loadRecommendations = true,
      loadPreferences = true,
    } = options;

    const startTime = Date.now();

    try {
      this.logger.info("Loading intelligent context", { sessionId });

      // 1. Load more turns than needed (for scoring/selection)
      const allTurns = await this.loadAllRecentTurns(sessionId, maxTurns);

      if (allTurns.length === 0) {
        this.logger.info("No conversation history, returning empty context");
        return {
          recentTurns: [],
          userPreferences: {},
          currentRecommendations: [],
          conversationStage: "greeting",
        };
      }

      // 2. Load user preferences and recommendations in parallel
      const [userPreferences, currentRecommendations] = await Promise.all([
        loadPreferences ? this.loadUserPreferences(sessionId) : {},
        loadRecommendations
          ? this.loadPreviousRecommendations(sessionId, allTurns)
          : [],
      ]);

      // 3. Use ContextSelector to select optimal context
      // 🎯 KEY DECISION POINT: Stage detection happens here (in ContextSelector)
      // ContextSelector determines conversation stage based on turn history & recommendations
      // It also scores relevance, summarizes old turns, and selects optimal context
      const optimizedContext =
        await this.contextSelector.selectContext({
          query: currentQuery,
          allTurns,
          userPreferences,
          currentRecommendations,
        });

      const duration = Date.now() - startTime;
      this.logger.info("Intelligent context loaded", {
        sessionId,
        totalTurns: allTurns.length,
        selectedTurns: optimizedContext.recentTurns.length,
        hasSummary: !!optimizedContext.userPreferences?.conversationSummary,
        duration,
      });

      return optimizedContext;
    } catch (error) {
      this.logger.error("Failed to load intelligent context", error as Error);

      // Fallback to simple context on error
      this.logger.warn("Falling back to simple context loading");
      return this.loadContext(sessionId, {
        maxTurns: 5,
        loadRecommendations,
        loadPreferences,
      });
    }
  }

  /**
   * Merge current entities with conversation context
   * Replaces: ChatService.mergeWithPreviousEntities() + context-gating logic
   *
   * @param current - Current extracted entities
   * @param context - Conversation context
   * @param message - User's current message
   * @param options - Merge options
   * @returns Merged entities
   */
  mergeWithContext(
    current: Partial<ExtractedEntitiesDto>,
    context: ConversationContext,
    message: string,
    options: ContextMergeOptions = {}
  ): ExtractedEntitiesDto {
    const { forceStrategy, preserveArrays = true } = options;

    // If no previous context, return current as-is
    if (context.recentTurns.length === 0) {
      return current as ExtractedEntitiesDto;
    }

    // Get previous turn entities
    const previous = this.getPreviousEntities(context);
    if (!previous) {
      return current as ExtractedEntitiesDto;
    }

    // Determine merge strategy
    const decision = forceStrategy
      ? this.createDecision(forceStrategy)
      : this.decideMergeStrategy(message, current, previous);

    this.logger.debug("Context merge decision", {
      strategy: decision.strategy,
      reason: decision.reason,
    });

    // Apply merge strategy
    return this.applyMergeStrategy(
      decision.strategy,
      current,
      previous,
      preserveArrays
    );
  }

  /**
   * Save conversation turn to database
   * Replaces: Manual save logic scattered in ChatService
   *
   * @param sessionId - Session identifier
   * @param request - User's chat request
   * @param response - Bot's response
   * @param entities - Extracted entities
   * @param items - Recommended items
   */
  async saveTurn(
    sessionId: string,
    request: ChatRequestDto,
    response: ChatResponseDto,
    entities: ExtractedEntitiesDto,
    items: EnrichedItem[]
  ): Promise<void> {
    try {
      // Use transaction for atomic save
      await db.transaction(async (tx) => {
        // Insert conversation turn
        await tx.insert(chatConversations).values({
          sessionId,
          userMessage: request.message,
          botResponse: response.reply,
          extractedEntities: entities as unknown as Record<string, unknown>,
          recommendedProducts: items.map((item) => item.id),
        });

        // Update session lastActivityAt
        await tx
          .update(chatSessions)
          .set({ lastActivityAt: new Date() })
          .where(eq(chatSessions.sessionId, sessionId));
      });

      this.logger.info("Saved conversation turn", {
        sessionId,
        entityCount: Object.keys(entities).length,
        itemCount: items.length,
      });
    } catch (error) {
      this.logger.error("Failed to save conversation turn", error as Error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════

  /**
   * Load recent turns without selection (NEW)
   * Used by intelligent context manager for scoring and selection
   *
   * @param sessionId - Session identifier
   * @param limit - Maximum number of turns to load
   * @returns Array of conversation turns
   */
  private async loadAllRecentTurns(
    sessionId: string,
    limit: number
  ): Promise<ConversationTurn[]> {
    const turnRecords = await db
      .select({
        userMessage: chatConversations.userMessage,
        botResponse: chatConversations.botResponse,
        extractedEntities: chatConversations.extractedEntities,
        recommendedProducts: chatConversations.recommendedProducts,
        timestamp: chatConversations.createdAt,
      })
      .from(chatConversations)
      .where(eq(chatConversations.sessionId, sessionId))
      .orderBy(desc(chatConversations.createdAt))
      .limit(limit);

    return turnRecords.reverse().map((record) => ({
      userMessage: record.userMessage,
      botResponse: record.botResponse,
      extractedEntities:
        (record.extractedEntities as ExtractedEntitiesDto) || {},
      timestamp: record.timestamp || new Date(),
    }));
  }

  /**
   * Load previous recommendations from database
   * ✅ FIXED: Now loads actual products from last conversation turn
   */
  private async loadPreviousRecommendations(
    sessionId: string,
    turns: ConversationTurn[]
  ): Promise<EnrichedItem[]> {
    try {
      if (turns.length === 0) {
        return [];
      }

      // ✅ Query the most recent conversation for this session
      const recentConvo = await db
        .select({
          recommendedProducts: chatConversations.recommendedProducts,
        })
        .from(chatConversations)
        .where(eq(chatConversations.sessionId, sessionId))
        .orderBy(desc(chatConversations.createdAt))
        .limit(1);

      if (!recentConvo || !recentConvo[0]?.recommendedProducts) {
        return [];
      }

      const productIds = recentConvo[0].recommendedProducts as number[];
      if (productIds.length === 0) return [];

      // ✅ Load full item details from catalog cache (not DB - faster!)
      const catalogCache = CatalogCacheService.getInstance();
      const catalogData = await catalogCache.getCatalog();

      // Map IDs to full EnrichedItem objects
      const items = catalogData.flat
        .filter((item) => productIds.includes(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          contractTerm: item.contractTerm,
          itemType: item.type as "solution" | "category" | "product",
          parentItem: null,
          targetAudience: null,
          features: [],
        }));

      this.logger.debug("Loaded previous recommendations", {
        sessionId,
        count: items.length,
        ids: productIds,
      });

      return items;
    } catch (error) {
      this.logger.warn("Failed to load previous recommendations", { error });
      return [];
    }
  }

  /**
   * Load user preferences from session
   */
  private async loadUserPreferences(
    sessionId: string
  ): Promise<Record<string, unknown>> {
    try {
      const sessionResult = await db
        .select({
          userPreferences: chatSessions.userPreferences,
        })
        .from(chatSessions)
        .where(eq(chatSessions.sessionId, sessionId));

      const session = sessionResult[0];
      return (session?.userPreferences as Record<string, unknown>) || {};
    } catch (error) {
      this.logger.warn("Failed to load user preferences", { error });
      return {};
    }
  }

  /**
   * Get previous turn entities
   */
  private getPreviousEntities(
    context: ConversationContext
  ): ExtractedEntitiesDto | null {
    const lastTurn = context.recentTurns
      .slice()
      .reverse()
      .find(
        (t) =>
          t.extractedEntities && Object.keys(t.extractedEntities).length > 0
      );

    return lastTurn?.extractedEntities || null;
  }

  /**
   * Decide merge strategy based on message analysis
   * Consolidates logic from context-gating.service
   */
  private decideMergeStrategy(
    message: string,
    current: Partial<ExtractedEntitiesDto>,
    previous: ExtractedEntitiesDto
  ): ContextCarryDecision {
    const lowerMsg = message.toLowerCase().trim();

    // 1. Check for affirmation
    if (this.isAffirmation(lowerMsg)) {
      return {
        shouldCarry: true,
        strategy: "affirmation",
        reason: "User affirmed previous context",
      };
    }

    // 2. Check for negation
    if (this.isNegation(lowerMsg)) {
      return {
        shouldCarry: false,
        strategy: "negation",
        reason: "User rejected previous context",
      };
    }

    // 3. Check for topic shift (solution or category changed)
    const topicShift = this.detectTopicShift(current, previous);
    if (topicShift) {
      return {
        shouldCarry: false,
        strategy: "topic_shift",
        reason: topicShift,
      };
    }

    // 4. Default: normal merge
    return {
      shouldCarry: true,
      strategy: "normal_merge",
      reason: "Same topic, adding details",
    };
  }

  /**
   * Check if message is an affirmation
   */
  private isAffirmation(message: string): boolean {
    return /^(yes|yup|yeah|sure|ok|okay|please|continue)\b/i.test(message);
  }

  /**
   * Check if message is a negation
   */
  private isNegation(message: string): boolean {
    return /^(no|nope|nah|not really|doesn'?t|didn'?t|not yet)\b/i.test(
      message
    );
  }

  /**
   * Detect topic shift between current and previous entities
   * @returns Shift reason if detected, null otherwise
   */
  private detectTopicShift(
    current: Partial<ExtractedEntitiesDto>,
    previous: ExtractedEntitiesDto
  ): string | null {
    const prevSol = (previous.solution || "").toLowerCase();
    const prevCat = (
      previous.category ||
      previous.product_category ||
      ""
    ).toLowerCase();
    const currSol = (current.solution || "").toLowerCase();
    const currCat = (
      current.category ||
      current.product_category ||
      ""
    ).toLowerCase();

    // Solution changed
    if (currSol && prevSol && currSol !== prevSol) {
      return `Solution changed from ${previous.solution} to ${current.solution}`;
    }

    // Category changed
    if (currCat && prevCat && currCat !== prevCat) {
      const prevDisplay = previous.category || previous.product_category;
      const currDisplay = current.category || current.product_category;
      return `Category changed from ${prevDisplay} to ${currDisplay}`;
    }

    return null;
  }

  /**
   * Apply merge strategy to combine entities
   */
  private applyMergeStrategy(
    strategy: MergeStrategy,
    current: Partial<ExtractedEntitiesDto>,
    previous: ExtractedEntitiesDto,
    preserveArrays: boolean
  ): ExtractedEntitiesDto {
    switch (strategy) {
      case "affirmation":
        // Carry all from previous, add anything new from current
        return { ...previous, ...current };

      case "negation":
        // Clear context, only use current
        return current as ExtractedEntitiesDto;

      case "topic_shift":
        // New topic, don't merge
        return current as ExtractedEntitiesDto;

      case "normal_merge":
      default:
        // Merge: carry forward missing fields, handle arrays
        return this.mergeEntities(current, previous, preserveArrays);
    }
  }

  /**
   * Merge entities with array handling
   */
  private mergeEntities(
    current: Partial<ExtractedEntitiesDto>,
    previous: ExtractedEntitiesDto,
    preserveArrays: boolean
  ): ExtractedEntitiesDto {
    const merged: Partial<ExtractedEntitiesDto> = {
      ...previous,
      ...current,
    };

    // Handle arrays specially if preserveArrays is true
    if (preserveArrays) {
      // Merge features
      if (previous.features || current.features) {
        merged.features = [
          ...(previous.features || []),
          ...(current.features || []),
        ];
        merged.features = [...new Set(merged.features)]; // Deduplicate
      }

      // Merge primary_use
      if (previous.primary_use || current.primary_use) {
        merged.primary_use = [
          ...(previous.primary_use || []),
          ...(current.primary_use || []),
        ];
        merged.primary_use = [...new Set(merged.primary_use)];
      }

      // Merge inferred_needs
      if (previous.inferred_needs || current.inferred_needs) {
        merged.inferred_needs = [
          ...(previous.inferred_needs || []),
          ...(current.inferred_needs || []),
        ];
        merged.inferred_needs = [...new Set(merged.inferred_needs)];
      }

      // Merge typical_needs
      if (previous.typical_needs || current.typical_needs) {
        merged.typical_needs = [
          ...(previous.typical_needs || []),
          ...(current.typical_needs || []),
        ];
        merged.typical_needs = [...new Set(merged.typical_needs)];
      }

      // Merge predicted_products
      if (previous.predicted_products || current.predicted_products) {
        merged.predicted_products = [
          ...(previous.predicted_products || []),
          ...(current.predicted_products || []),
        ];
        merged.predicted_products = [...new Set(merged.predicted_products)];
      }
    }

    return merged as ExtractedEntitiesDto;
  }

  /**
   * Create a decision with the given strategy
   */
  private createDecision(strategy: MergeStrategy): ContextCarryDecision {
    const shouldCarry = strategy !== "negation" && strategy !== "topic_shift";
    return {
      shouldCarry,
      strategy,
      reason: `Forced strategy: ${strategy}`,
    };
  }
}
