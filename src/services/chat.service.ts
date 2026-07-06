// src/services/chat.service.ts

/**
 * ChatService: Main orchestrator for conversation flow and product recommendations
 *
 * Two architectures:
 * - NEW (Catalog-in-Prompt): processMessage() and processMessageStream() - sends entire catalog to Gemini for direct recommendations
 * - DEPRECATED (Multi-Step Pipeline): processChat() and processChatStream() - multi-step entity extraction (removal Q2 2026)
 *
 * Handles: Intent classification, context loading, catalog fetching,
 * recommendation generation, streaming responses, and conversation turn persistence.
 *
 * NOTE: Deterministic fast-track path removed - all messages now go through Gemini for consistent AI-powered responses.
 */

import { db } from "../db/index.js";
import { eq } from "drizzle-orm";
import { chatConversations } from "../models/schema.model.js";
import {
  ChatRequestDto,
  ChatResponseDto,
  EnrichedItem,
  ConversationTurn,
  ConversationContext,
  ExtractedEntities,
} from "../dtos/chat.dto.js";
import { ItemDto } from "../dtos/item.dto.js";
import { LangChainService } from "./langchain.service.js";
import { IntelligentFallbackService } from "./intelligent-fallback.service.js";
import { ItemSearchService } from "./item-search.service.js";
import { SessionManagementService } from "./session-management.service.js";
import { TopicSwitchDetectorService } from "./topic-switch-detector.service.js";
import { Logger } from "../utils/logger.js";
import { AppError } from "../middleware/errorHandler.js";
import { Socket } from "socket.io";
import { CatalogCacheService } from "./catalog-cache.service.js";
import { ContextService } from "./context.service.js";
import { ContextSelector } from "./context-selector.service.js";
import { GeminiIntentClassifierService } from "./gemini-intent-classifier.service.js";

export class ChatService {
  private langChainService: LangChainService;
  private intelligentFallbackService: IntelligentFallbackService;
  private itemSearchService: ItemSearchService;

  private sessionService: SessionManagementService;
  private logger: Logger;
  // 🔥 NEW: Request deduplication to prevent same message being processed multiple times
  private recentRequests: Map<string, number> = new Map();
  // NEW: Catalog-in-Prompt services (Phase 4)
  private catalogCache: CatalogCacheService;
  private contextService: ContextService;
  private contextSelector: ContextSelector;
  // NEW: Gemini Intent Classifier (replaces regex patterns)
  private intentClassifier: GeminiIntentClassifierService;
  // NEW: Topic Switch Detector (prevents response accumulation)
  private topicSwitchDetector: TopicSwitchDetectorService;

  constructor(
    itemSearchService?: ItemSearchService,
    sessionService?: SessionManagementService
  ) {
    this.langChainService = new LangChainService();
    this.intelligentFallbackService = new IntelligentFallbackService();
    this.itemSearchService = itemSearchService || new ItemSearchService();
    this.sessionService = sessionService || new SessionManagementService();
    this.logger = new Logger({ serviceName: "ChatService" });

    // NEW: Catalog-in-Prompt services (Phase 4)
    this.catalogCache = CatalogCacheService.getInstance();
    this.contextService = new ContextService();
    this.contextSelector = new ContextSelector();
    // NEW: Gemini Intent Classifier
    this.intentClassifier = new GeminiIntentClassifierService();
    // NEW: Topic Switch Detector
    this.topicSwitchDetector = new TopicSwitchDetectorService();
  }

  /**
   * Drill-down detection — extracts the candidate product/topic name from
   * "tell me more about X" / "describe X" / "what is X" style messages.
   * Returns null if the message isn't a drill-down request, or if the trigger
   * phrase isn't followed by a specific name (e.g. "tell me more").
   *
   * Public so it can be unit-tested in isolation.
   */
  detectDrillDownCandidate(message: string): string | null {
    if (!message || !message.trim()) return null;

    const patterns: RegExp[] = [
      /\btell me more about\s+(.+)/i,
      /\bmore details? about\s+(.+)/i,
      /\bmore details? on\s+(.+)/i,
      /\bmore info(?:rmation)? (?:about|on)\s+(.+)/i,
      /\bdescribe\s+(.+)/i,
      /\bwhat (?:is|are)\s+(.+)/i,
    ];

    for (const re of patterns) {
      const m = re.exec(message);
      if (m && m[1]) {
        const candidate = m[1].trim().replace(/[?.!]+$/, "").trim();
        // Reject pronouns / vague placeholders — caller should fall through to LLM.
        if (
          candidate.length === 0 ||
          /^(it|that|this|them|those|these)$/i.test(candidate)
        ) {
          return null;
        }
        return candidate;
      }
    }

    return null;
  }

  /**
   * If the user's message is a drill-down ("tell me more about X"), look X up
   * in the catalog and return a canonical reply built from the actual stored
   * description. Returns null if either the message isn't a drill-down or no
   * matching product is found, in which case callers fall through to the LLM.
   *
   * Bypasses the LLM entirely on success (UAT FAIL fixes for FB-005, CC-04).
   */
  async tryDrillDownLookup(
    message: string,
    itemSearchService: ItemSearchService = this.itemSearchService
  ): Promise<{ reply: string; items: EnrichedItem[] } | null> {
    const candidate = this.detectDrillDownCandidate(message);
    if (!candidate) return null;

    const items = await itemSearchService.searchByNames([candidate], [], 3);
    if (!items || items.length === 0) return null;

    const top = items[0];
    const description =
      top.description && top.description.trim().length > 0
        ? top.description.trim()
        : "More details aren't available in the catalog yet — would you like to compare with alternatives?";

    const reply = `**${top.name}** — ${description}\n\nWould you like to compare with alternatives or move on to next steps?`;

    return { reply, items };
  }

  /**
   * Count conversation turns for a session (used by turn cap guard).
   */
  async getConversationCount(sessionId: string): Promise<number> {
    return this.contextService.getConversationCount(sessionId);
  }

  /**
   * Maps an internal EnrichedItem object to an external ItemDto.
   * Features are excluded from recommendations to keep focus on item descriptions.
   */
  private mapToItemDto(product: EnrichedItem): ItemDto {
    const dto = new ItemDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.description = product.description || null;
    dto.itemType = product.itemType;
    dto.parentItemId = product.parentItem?.id || null;
    dto.price = product.price || null;
    dto.contractTerm = product.contractTerm || null;
    dto.targetAudience = product.targetAudience?.name || undefined;
    dto.isActive = true;
    dto.features = []; // Excluded to keep AI context focused on descriptions
    dto.createdAt = new Date().toISOString();
    return dto;
  }

  /**
   * Wipe all conversation turns for a given session. Idempotent — safe to call
   * on a session that has no rows yet. Returns the number of rows deleted.
   *
   * Used by the frontend "reset" button so prior context (entities, products,
   * industry mentions) doesn't leak into the next conversation.
   * UAT FAIL fix for context-bleed seen in CC-005, ERR-007.
   */
  async resetSession(sessionId: string): Promise<{ deletedRows: number }> {
    try {
      const result = await db
        .delete(chatConversations)
        .where(eq(chatConversations.sessionId, sessionId))
        .returning({ id: chatConversations.id });

      this.logger.info("Session reset", {
        sessionId,
        deletedRows: result.length,
      });

      return { deletedRows: result.length };
    } catch (error) {
      this.logger.error(
        "Failed to reset session",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  // 🆕 NEW: Get chat history (implement the placeholder from controller)
  async getChatHistory(sessionId: string): Promise<ConversationTurn[]> {
    try {
      const conversations = await db
        .select({
          userMessage: chatConversations.userMessage,
          botResponse: chatConversations.botResponse,
          createdAt: chatConversations.createdAt,
        })
        .from(chatConversations)
        .where(eq(chatConversations.sessionId, sessionId))
        .orderBy(chatConversations.createdAt);

      return conversations.map((conv) => ({
        userMessage: conv.userMessage,
        botResponse: conv.botResponse,
        timestamp: conv.createdAt || new Date(),
      }));
    } catch (error) {
      this.logger.error("Failed to get chat history", error as Error);
      return [];
    }
  }

  // Helper method for fallback responses
  private getFallbackResponseText(
    products: EnrichedItem[],
    userMessage?: string
  ): string {
    // If we have products and a user message, use intelligent fallback
    if (userMessage && userMessage.trim()) {
      try {
        const intelligentRecommendation =
          this.intelligentFallbackService.generateScenarioBasedRecommendations(
            userMessage,
            products
          );
        return intelligentRecommendation.primaryRecommendation;
      } catch (error) {
        console.warn(
          "Intelligent fallback failed, using basic fallback:",
          error
        );
      }
    }

    // Basic fallback for when we have no context or intelligent fallback fails
    if (products.length === 0) {
      return "I apologize, but I don't have specific products in my database that match your requirements at the moment. However, I'd be happy to connect you with our team who can provide personalized recommendations.\n\nPlease visit our Contact Us page or call our support team, and they'll be able to assist you with finding the perfect solution for your needs.";
    }

    // 🔥 CHANGED: Show TOP 3 with full descriptions
    const topProducts = products.slice(0, 3);
    const productDescriptions = topProducts
      .map((p, index) => {
        const description = p.description || "Description not available";
        return `${index + 1}. **${p.name}**: ${description}`;
      })
      .join("\n\n");

    return `I found some great options for you:\n\n${productDescriptions}\n\nDoes that answer your question?`;
  }

  /**
   * NEW: Stream message processing with catalog-in-prompt (Phase 4 + Streaming)
   * Streams tokens to Socket.IO for real-time UI updates
   */
  async processMessageStream(
    request: ChatRequestDto,
    socket: Socket
  ): Promise<void> {
    const { message, session_id } = request;
    const startTime = Date.now();

    // 🔥 NEW: Deduplicate requests to prevent same message being processed multiple times
    const requestKey = `${session_id}:${message}`;
    const now = Date.now();
    const lastRequestTime = this.recentRequests.get(requestKey);

    if (lastRequestTime && now - lastRequestTime < 2000) {
      // Same request within 2 seconds - likely a duplicate, ignore it
      this.logger.warn("🚫 DUPLICATE REQUEST DETECTED - Ignoring", {
        sessionId: session_id,
        messagePreview: message.substring(0, 50),
        timeSinceLastRequest: now - lastRequestTime,
      });
      return;
    }

    // Record this request
    this.recentRequests.set(requestKey, now);

    // Clean up old entries (keep last 100 requests)
    if (this.recentRequests.size > 100) {
      const oldestKey = this.recentRequests.keys().next().value;
      if (oldestKey) this.recentRequests.delete(oldestKey);
    }

    this.logger.info(
      "🔍 DIAGNOSTIC: Processing message (catalog-in-prompt, streaming)",
      {
        sessionId: session_id,
        messageLength: message.length,
        socketId: socket.id,
        rawMessage: message,
      }
    );

    try {
      // 🆕 STEP 1: Classify intent using Gemini (replaces regex patterns)
      const intentClassification = await this.intentClassifier.classifyIntent(
        message
      );

      // 🔥 Extract normalized message from Gemini (typos fixed, standardized)
      const normalizedMessage =
        intentClassification.normalizedMessage || message;

      this.logger.info("🔍 Intent classified", {
        sessionId: session_id,
        originalMessage: message,
        normalizedMessage,
        intent: intentClassification.intent,
        confidence: intentClassification.confidence,
        solution: intentClassification.extractedContext.solution,
        reasoning: intentClassification.reasoning,
      });

      // 🆕 STEP 2: Handle greeting intent immediately
      // 🔥 High confidence threshold (0.9) to avoid misclassifying product queries as greetings
      if (
        intentClassification.intent === "greeting" &&
        intentClassification.confidence >= 0.9
      ) {
        this.logger.info("✅ Greeting intent detected (streaming)", {
          sessionId: session_id,
          confidence: intentClassification.confidence,
        });

        // Ensure session exists before saving greeting
        await this.sessionService.getOrCreateSession(session_id);

        // Return greeting message without product recommendations
        const greetingMessage =
          "Hi! I'm Convo, your Converge ICT assistant. I can help you find the right internet, security, transport, or managed services solution for your business. What are you looking for?";

        // 🔥 Signal start of new response (frontend should clear previous messages)
        socket.emit("start", { sessionId: session_id });

        // Emit greeting as stream
        socket.emit("token", { payload: greetingMessage, isComplete: true });
        socket.emit("recommendations", { payload: [] });
        socket.emit("end");

        // Save greeting turn
        const greetingResponse = {
          reply: greetingMessage,
          recommended_items: [],
          session_id,
          conversation_context: "greeting",
        };

        await this.contextService.saveTurn(
          session_id,
          request,
          greetingResponse,
          { intent: "greeting" },
          []
        );

        return;
      }

      // 🆕 STEP 2b: Handle off-topic intent immediately
      if (intentClassification.intent === "off_topic") {
        this.logger.info("🚫 Off-topic intent detected (streaming)", {
          sessionId: session_id,
          message,
        });

        const offTopicMessage =
          "I'm Convo, your Converge ICT solutions assistant — I can help with internet, security, transport, managed services, cloud, data center, content, and satellite products. What ICT solution can I help you with?";

        socket.emit("start", { sessionId: session_id });
        socket.emit("token", { payload: offTopicMessage, isComplete: true });
        socket.emit("recommendations", { payload: [] });
        socket.emit("end");
        return;
      }

      // 🆕 STEP 2c: Handle "Help me choose" clarification-request flow.
      // Asks a short set of clarifying questions (use case, size, priority) before
      // recommending anything. Scope-bounded; no product mentions.
      if (intentClassification.intent === "clarification_request") {
        this.logger.info("❓ Clarification request intent detected (streaming)", {
          sessionId: session_id,
        });

        await this.sessionService.getOrCreateSession(session_id);

        const clarifyingMessage =
          "Happy to help you find the right fit. A couple of quick questions:\n" +
          "1. What's the main use case — office, hotel, retail, remote site, or something else?\n" +
          "2. Roughly how many users or employees does this need to cover?\n" +
          "3. What matters most — speed, security, reliability, or support?";

        socket.emit("start", { sessionId: session_id });
        socket.emit("token", { payload: clarifyingMessage, isComplete: true });
        socket.emit("recommendations", { payload: [] });
        socket.emit("end");

        await this.contextService.saveTurn(
          session_id,
          request,
          {
            reply: clarifyingMessage,
            recommended_items: [],
            session_id,
            conversation_context: "clarification_request",
          },
          { intent: "clarification_request" },
          []
        );

        return;
      }

      // 🔍 ADD: Log non-greeting message processing
      this.logger.info("🔍 STREAMING: Processing non-greeting message", {
        sessionId: session_id,
        messagePreview: message.substring(0, 50),
        normalizedPreview: normalizedMessage.substring(0, 50),
        timestamp: new Date().toISOString(),
      });

      // 🆕 STEP 3: Ensure session exists (for all non-greeting queries)
      await this.sessionService.getOrCreateSession(session_id);

      // 🆕 STEP 3.5: Drill-down product lookup ("Tell me more about X")
      // Bypasses the LLM and returns the actual catalog description from DB.
      // UAT FAIL fixes for FB-005 and CC-04.
      const drillDown = await this.tryDrillDownLookup(message);
      if (drillDown) {
        this.logger.info("🔎 Drill-down hit — bypassing LLM (streaming)", {
          sessionId: session_id,
          matchedItem: drillDown.items[0]?.name,
        });

        socket.emit("start", { sessionId: session_id });
        socket.emit("token", {
          payload: drillDown.reply,
          isComplete: true,
        });
        socket.emit("recommendations", {
          payload: drillDown.items.map((it) => this.mapToItemDto(it)),
        });
        socket.emit("end");

        await this.contextService.saveTurn(
          session_id,
          request,
          {
            reply: drillDown.reply,
            recommended_items: drillDown.items.map((it) =>
              this.mapToItemDto(it)
            ),
            session_id,
            conversation_context: "drill_down",
          },
          { intent: "drill_down" },
          drillDown.items
        );

        return;
      }

      // 🆕 STEP 4: Load intelligent conversation context
      const context = await this.contextService.loadIntelligentContext(
        session_id,
        message,
        { maxTurns: 15, loadRecommendations: true, loadPreferences: true }
      );

      // ⚡ PERF: entity extraction and topic-switch detection are independent
      // Gemini calls (neither reads the other's output), so run them
      // concurrently to remove one round-trip from the critical path. The skip
      // condition is computed from the loaded stage, which is identical to the
      // post-promotion stage here: promoteStageWithEntities treats "feedback" as
      // a locked stage and never produces it, so this changes no behavior.
      const isSimpleConfirmation = this.isSimpleConfirmation(normalizedMessage);
      const shouldSkipTopicDetection =
        context.conversationStage === "feedback" && isSimpleConfirmation;
      const shouldDetectTopic =
        context.recentTurns.length > 0 && !shouldSkipTopicDetection;

      const [extractedEntities, topicSwitch] = await Promise.all([
        this.extractEntitiesForContext(normalizedMessage, context),
        shouldDetectTopic
          ? this.topicSwitchDetector
              .detectTopicSwitch(normalizedMessage, context)
              .catch((error) => {
                this.logger.warn("Topic switch detection failed (stream)", {
                  error: (error as Error).message,
                });
                return null;
              })
          : Promise.resolve(null),
      ]);

      // Apply entity result + stage promotion BEFORE the topic-switch override,
      // matching the original ordering (promotion sets the stage that the
      // topic-switch override then reads via its !== "feedback" guard).
      context.entities = extractedEntities;
      this.applyEntityPromotion(context, extractedEntities);

      // 🆕 STEP 4.1: Contextualize vague first messages (self-declarations with no history)
      // When preset buttons or vague self-declarations are the first message,
      // rewrite for Gemini so it asks discovery questions instead of dumping products
      let contextualizedFirstMessage: string | null = null;
      if (context.recentTurns.length === 0) {
        const vagueSelfDeclarations: Record<string, string> = {
          comparison:
            "The user wants to compare products but hasn't specified which. Ask what solutions or products they'd like to compare.",
          clarification:
            "The user wants to learn more but hasn't specified about what. Ask what product or topic they'd like clarification on.",
        };

        if (vagueSelfDeclarations[intentClassification.intent]) {
          contextualizedFirstMessage =
            vagueSelfDeclarations[intentClassification.intent];
          context.conversationStage = "discovery";
          this.logger.info(
            "🔄 Vague first message detected — contextualizing for discovery",
            {
              sessionId: session_id,
              originalIntent: intentClassification.intent,
              contextualizedMessage: contextualizedFirstMessage,
            }
          );
        }
      }

      // 🔍 CRITICAL DIAGNOSTIC: Log context details
      this.logger.info("🔍 CONTEXT LOADED", {
        sessionId: session_id,
        conversationStage: context.conversationStage,
        recentTurnsCount: context.recentTurns.length,
        recentTurnsPreview: context.recentTurns.map((t) => ({
          user: t.userMessage.substring(0, 30),
          bot: t.botResponse.substring(0, 50),
        })),
        currentRecommendationsCount: context.currentRecommendations.length,
      });

      // 🔥 STEP 4.5 - Apply topic-switch result (detected concurrently above).
      // 🚨 Only override stage if NOT in feedback stage; feedback is preserved
      // unless it's a clear topic switch. topicSwitch is null when detection was
      // skipped (feedback + simple confirmation) or when the Gemini call errored.
      if (topicSwitch) {
        // 🚨 FIX: Only override stage if NOT in feedback stage
        // Feedback stage should be preserved unless it's a clear topic switch
        if (topicSwitch.isSwitched && topicSwitch.switchType === "switch") {
          context.currentRecommendations = [];
          context.conversationStage = "discovery";
        } else if (
          topicSwitch.switchType === "clarification" &&
          context.conversationStage !== "feedback"
        ) {
          // Don't override feedback stage with refinement
          context.conversationStage = "refinement";
        }
      } else if (shouldSkipTopicDetection) {
        this.logger.info(
          "Skipping topic detection - feedback stage with simple confirmation",
          {
            conversationStage: context.conversationStage,
            message: normalizedMessage,
          }
        );
      }

      // 🚀 NEW: STEP 4.6 - Deterministic "Yes" Path (Skip LLM for positive confirmations)
      // OPTIMIZATION: Save API costs and latency for simple "yes" responses
      if (
        context.conversationStage === "feedback" &&
        isSimpleConfirmation &&
        this.isPositiveConfirmation(normalizedMessage) &&
        context.currentRecommendations.length > 0 // Ensure user actually saw recommendations
      ) {
        this.logger.info("✅ Deterministic YES path - skipping LLM call", {
          sessionId: session_id,
          message: normalizedMessage,
          savedApiCall: true,
          previousRecommendations: context.currentRecommendations.length,
        });

        // Deterministic closing response
        const closingMessage =
          "Perfect! I'm glad I could help. If you'd like to move forward:\n\n" +
          "- Get Pricing: Contact our team at GlobalBusiness@convergeict.com\n\n" +
          "Is there anything else I can help you with today?";

        // 🔥 Signal start to clear frontend
        socket.emit("start", { sessionId: session_id });

        // Send the deterministic message in one shot
        socket.emit("token", { payload: closingMessage, isComplete: true });
        socket.emit("recommendations", { payload: [] }); // No new recommendations
        socket.emit("end");

        const duration = Date.now() - startTime;
        this.logger.info("✅ Deterministic YES path completed", {
          sessionId: session_id,
          duration,
          apiCallSkipped: true,
          costSaved: "$0.001",
        });

        // Save conversation turn
        const responseDto: ChatResponseDto = {
          reply: closingMessage,
          recommended_items: [],
          session_id,
          conversation_context: "closing", // 🔥 Mark as closing stage
        };

        await this.contextService.saveTurn(
          session_id,
          request,
          responseDto,
          { intent: "confirmation_yes" }, // 🔥 Track as deterministic confirmation
          []
        );

        return; // ← Exit early, skip Gemini call!
      }

      // 3. Get catalog from cache
      const catalogData = await this.catalogCache.getCatalog();
      this.logger.debug("Catalog retrieved (streaming)", {
        itemCount: catalogData.metadata.itemCount,
        solutionCount: catalogData.metadata.solutionCount,
        cached: true,
      });

      // 🔥 CRITICAL FIX: Signal start BEFORE calling Gemini
      // This ensures frontend clears tokens immediately, not after AI finishes
      socket.emit("start", { sessionId: session_id });

      // 4. Get structured recommendation from Gemini (non-streaming)
      // 🔥 FIX: Don't stream raw JSON to user! Get structured data first, then stream the reply field
      // Priority: vague first-message contextualization > feedback contextualization > normalized message
      const messageToSend =
        contextualizedFirstMessage ||
        this.contextualizeNegativeFeedback(normalizedMessage, context);

      const recommendation =
        await this.langChainService.generateRecommendationsFromCatalog({
          message: messageToSend, // 🔥 Use contextualized message for "no" responses
          catalog: catalogData.flat,
          context,
        });

      // 🔍 CRITICAL DIAGNOSTIC: Log exactly what Gemini returned
      this.logger.info("🔍 GEMINI RESPONSE RECEIVED (streaming)", {
        sessionId: session_id,
        replyLength: recommendation.reply.length,
        replyPreview: recommendation.reply.substring(0, 200),
        replyContainsGreeting: recommendation.reply.includes(
          "Hello! I'm here to help"
        ),
        solutionReturned: recommendation.solution,
        categoryReturned: recommendation.category,
        itemCount: recommendation.recommendedItems.length,
      });

      // 5. Send the full reply in one shot (messenger-style, no streaming)
      const reply = recommendation.reply;
      socket.emit("token", { payload: reply, isComplete: true });

      const duration = Date.now() - startTime;
      this.logger.info("Message sent successfully", {
        sessionId: session_id,
        duration,
        responseLength: reply.length,
      });

      // Map to enriched items
      const enrichedItems: EnrichedItem[] = recommendation.recommendedItems.map(
        (item) => {
          const fullItem = catalogData.flat.find((c) => c.id === item.id);
          return {
            id: item.id,
            name: item.name,
            description: fullItem?.description || null,
            price: fullItem?.price || null,
            contractTerm: fullItem?.contractTerm || null,
            itemType: (fullItem?.type || "product") as
              | "solution"
              | "category"
              | "product",
            parentItem: null,
            targetAudience: null,
            features: [],
          };
        }
      );

      // 6. Send structured recommendations
      socket.emit("recommendations", {
        payload: enrichedItems.map((item) => this.mapToItemDto(item)),
      });
      socket.emit("end");

      // 7. Save conversation turn (use clean natural language reply, not raw JSON)
      const responseDto: ChatResponseDto = {
        reply: recommendation.reply, // 🔥 Clean natural language reply
        recommended_items: enrichedItems.map((item) => this.mapToItemDto(item)),
        session_id,
        conversation_context: context.conversationStage,
      };

      await this.contextService.saveTurn(
        session_id,
        request,
        responseDto,
        {
          solution: recommendation.solution || undefined, // 🔥 Handle null solution (feedback stage)
          category: recommendation.category || undefined, // 🔥 Handle null category (feedback stage)
        },
        enrichedItems
      );
    } catch (error) {
      this.logger.error(
        `Error streaming message for session ${session_id}`,
        error instanceof Error ? error : new Error(String(error))
      );

      // Send fallback response
      socket.emit("token", {
        payload:
          "I'm having trouble processing your request right now. Please try again.",
        isComplete: true,
      });
      socket.emit("recommendations", { payload: [] });
      socket.emit("end");
    }
  }

  /**
   * NEW: Simplified message processing with catalog-in-prompt (Phase 4)
   * This method uses the new catalog-in-prompt architecture, eliminating
   * the need for multiple scoring and matching services.
   *
   * FIXED (Phase 5): All 5 bugs resolved
   * - ✅ Property destructuring (session_id)
   * - ✅ Method call (recommend not match)
   * - ✅ saveTurn arguments (3 args, not 2)
   * - ✅ CatalogData handling (catalogData.flat)
   * - ✅ Response DTO format (removed invalid properties)
   */
  async processMessage(request: ChatRequestDto): Promise<ChatResponseDto> {
    // ✅ FIX #1: Correct property destructuring
    const { message, session_id } = request;
    const startTime = Date.now();

    // 🔥 NEW: Deduplicate requests to prevent same message being processed multiple times
    const requestKey = `${session_id}:${message}`;
    const now = Date.now();
    const lastRequestTime = this.recentRequests.get(requestKey);

    if (lastRequestTime && now - lastRequestTime < 2000) {
      // Same request within 2 seconds - likely a duplicate, throw error
      this.logger.warn("🚫 DUPLICATE REQUEST DETECTED - Rejecting", {
        sessionId: session_id,
        messagePreview: message.substring(0, 50),
        timeSinceLastRequest: now - lastRequestTime,
      });
      throw new AppError(
        "Duplicate request detected. Please wait before sending the same message again.",
        429
      );
    }

    // Record this request
    this.recentRequests.set(requestKey, now);

    // Clean up old entries (keep last 100 requests)
    if (this.recentRequests.size > 100) {
      const oldestKey = this.recentRequests.keys().next().value;
      if (oldestKey) this.recentRequests.delete(oldestKey);
    }

    this.logger.info("🔍 DIAGNOSTIC: Processing message (catalog-in-prompt)", {
      sessionId: session_id,
      messageLength: message.length,
      rawMessage: message, // 🔍 LOG: See exact user input
    });

    try {
      // 🆕 STEP 1: Classify intent using Gemini (replaces regex patterns)
      const intentClassification = await this.intentClassifier.classifyIntent(
        message
      );

      // 🔥 Extract normalized message from Gemini (typos fixed, standardized)
      const normalizedMessage =
        intentClassification.normalizedMessage || message;

      this.logger.info("🔍 Intent classified", {
        sessionId: session_id,
        originalMessage: message,
        normalizedMessage,
        intent: intentClassification.intent,
        confidence: intentClassification.confidence,
        solution: intentClassification.extractedContext.solution,
        reasoning: intentClassification.reasoning,
      });

      // 🆕 STEP 2: Handle greeting intent immediately
      // 🔥 High confidence threshold (0.9) to avoid misclassifying product queries as greetings
      if (
        intentClassification.intent === "greeting" &&
        intentClassification.confidence >= 0.9
      ) {
        this.logger.info("✅ Greeting intent detected", {
          sessionId: session_id,
          confidence: intentClassification.confidence,
        });

        // Ensure session exists before saving greeting
        await this.sessionService.getOrCreateSession(session_id);

        // Return greeting message without product recommendations
        const greetingResponse: ChatResponseDto = {
          reply:
            "Hello! What ICT solution are you looking for today? I can help with internet, security, transport, managed services, content, or satellite.",
          session_id,
          conversation_context: "greeting",
          recommended_items: [],
        };

        // Save greeting turn
        await this.contextService.saveTurn(
          session_id,
          request,
          greetingResponse,
          { intent: "greeting" },
          []
        );

        return greetingResponse;
      }

      // 🆕 STEP 2b: Handle off-topic intent immediately
      if (intentClassification.intent === "off_topic") {
        return {
          reply:
            "I'm Convo, your Converge ICT solutions assistant — I can only help with internet, security, transport, managed services, content, and satellite products. What ICT solution can I help you with?",
          session_id,
          conversation_context: "off_topic",
          recommended_items: [],
        };
      }

      // 🆕 STEP 3: Ensure session exists (for all non-greeting queries)
      await this.sessionService.getOrCreateSession(session_id);

      // 🆕 STEP 3.5: Drill-down product lookup ("Tell me more about X")
      // UAT FAIL fixes for FB-005 and CC-04 (non-streaming flow).
      const drillDown = await this.tryDrillDownLookup(message);
      if (drillDown) {
        this.logger.info("🔎 Drill-down hit — bypassing LLM", {
          sessionId: session_id,
          matchedItem: drillDown.items[0]?.name,
        });

        const drillResponse: ChatResponseDto = {
          reply: drillDown.reply,
          recommended_items: drillDown.items.map((it) => this.mapToItemDto(it)),
          session_id,
          conversation_context: "drill_down",
        };

        await this.contextService.saveTurn(
          session_id,
          request,
          drillResponse,
          { intent: "drill_down" },
          drillDown.items
        );

        return drillResponse;
      }

      // 🆕 STEP 4: Load intelligent conversation context
      const context = await this.contextService.loadIntelligentContext(
        session_id,
        message,
        {
          maxTurns: 15, // Increased for intelligent selection
          loadRecommendations: true,
          loadPreferences: true,
        }
      );

      await this.extractAndPromoteEntities(normalizedMessage, context);

      // ✅ ADD: Log context for debugging multi-turn issues
      const userIntent = this.detectUserIntent(normalizedMessage);
      this.logger.info("🔍 DIAGNOSTIC: Loaded conversation context", {
        sessionId: session_id,
        turnCount: context.recentTurns.length,
        prevRecommendations: context.currentRecommendations.length, // Should be > 0 after first turn
        conversationStage: context.conversationStage,
        userIntent, // "alternatives", "add_to_topic", "topic_shift", "initial_query"
        classifiedIntent: intentClassification.intent, // 🔍 LOG: Gemini-classified intent
        intentConfidence: intentClassification.confidence,
      });

      // 🔥 NEW: STEP 4.5 - Detect topic switch to prevent response accumulation
      // 🚨 CRITICAL FIX: Skip topic detection if in feedback stage with simple confirmation
      const isSimpleConfirmation = this.isSimpleConfirmation(normalizedMessage);
      const shouldSkipTopicDetection =
        context.conversationStage === "feedback" && isSimpleConfirmation;

      if (context.recentTurns.length > 0 && !shouldSkipTopicDetection) {
        try {
          const topicSwitch = await this.topicSwitchDetector.detectTopicSwitch(
            normalizedMessage,
            context
          );

          this.logger.info("🔍 Topic switch analysis", {
            sessionId: session_id,
            isSwitched: topicSwitch.isSwitched,
            switchType: topicSwitch.switchType,
            previousTopic: topicSwitch.previousTopic,
            currentTopic: topicSwitch.currentTopic,
            confidence: topicSwitch.confidence,
            reasoning: topicSwitch.reasoning,
          });

          // If topic switched to completely different solution, clear previous recommendations
          if (topicSwitch.isSwitched && topicSwitch.switchType === "switch") {
            this.logger.info(
              "Topic switch detected, clearing previous recommendations",
              {
                from: topicSwitch.previousTopic,
                to: topicSwitch.currentTopic,
              }
            );
            context.currentRecommendations = [];
            // Update conversation stage to discovery (new topic exploration)
            context.conversationStage = "discovery";
          }

          // 🚨 FIX: If clarification, update stage to refinement ONLY if not in feedback
          if (
            topicSwitch.switchType === "clarification" &&
            context.conversationStage !== "feedback"
          ) {
            context.conversationStage = "refinement";
          }
        } catch (error) {
          // Non-critical error - continue with existing context
          this.logger.warn(
            "Topic switch detection failed, continuing with existing context",
            {
              error: (error as Error).message,
            }
          );
        }
      }

      // 🚀 NEW: STEP 4.6 - Deterministic "Yes" Path (Skip LLM for positive confirmations)
      // OPTIMIZATION: Save API costs and latency for simple "yes" responses
      if (
        context.conversationStage === "feedback" &&
        isSimpleConfirmation &&
        this.isPositiveConfirmation(normalizedMessage) &&
        context.currentRecommendations.length > 0 // Ensure user actually saw recommendations
      ) {
        this.logger.info("✅ Deterministic YES path - skipping LLM call", {
          sessionId: session_id,
          message: normalizedMessage,
          savedApiCall: true,
          previousRecommendations: context.currentRecommendations.length,
        });

        // Deterministic closing response
        const closingMessage =
          "Perfect! I'm glad I could help. If you'd like to move forward:\n\n" +
          "- Get Pricing: Contact our team at GlobalBusiness@convergeict.com\n\n" +
          "Is there anything else I can help you with today?";

        const responseDto: ChatResponseDto = {
          reply: closingMessage,
          recommended_items: [],
          session_id,
          conversation_context: "closing", // 🔥 Mark as closing stage
        };

        await this.contextService.saveTurn(
          session_id,
          request,
          responseDto,
          { intent: "confirmation_yes" }, // 🔥 Track as deterministic confirmation
          []
        );

        const duration = Date.now() - startTime;
        this.logger.info("✅ Deterministic YES path completed", {
          sessionId: session_id,
          duration,
          apiCallSkipped: true,
          costSaved: "$0.001",
        });

        return responseDto; // ← Exit early, skip Gemini call!
      }

      // 🎯 NEW: STEP 4.7 - Handle negative feedback with contextualized message
      // When user says "no" in feedback stage, add context to stay in same solution
      let contextualizedMessage = normalizedMessage;
      if (
        context.conversationStage === "feedback" &&
        isSimpleConfirmation &&
        this.isNegativeConfirmation(normalizedMessage) &&
        context.currentRecommendations.length > 0
      ) {
        // Extract the current solution from context
        const currentTopic = this.extractCurrentTopic(context);

        this.logger.info(
          "🔍 Negative feedback detected - contextualizing message",
          {
            sessionId: session_id,
            currentSolution: currentTopic.solution,
            currentCategory: currentTopic.category,
          }
        );

        // 🔥 CRITICAL: Override the message to instruct staying in same solution
        contextualizedMessage = currentTopic.solution
          ? `The user said "no" to the previous ${
              currentTopic.solution
            } recommendations. Please recommend DIFFERENT ${
              currentTopic.solution
            } products that were NOT already recommended. Stay within ${
              currentTopic.solution
            } - do NOT switch to other solutions. ${
              currentTopic.category
                ? `Previous category was ${currentTopic.category}. You can show alternatives from other ${currentTopic.solution} categories.`
                : ""
            }`
          : normalizedMessage;

        this.logger.info("🔍 Contextualized message for negative feedback", {
          sessionId: session_id,
          original: normalizedMessage,
          contextualized: contextualizedMessage.substring(0, 200),
        });
      }

      // 4. Get catalog from cache
      // ✅ FIX #4: Handle CatalogData structure properly
      const catalogData = await this.catalogCache.getCatalog();
      this.logger.debug("Catalog retrieved", {
        itemCount: catalogData.metadata.itemCount,
        solutionCount: catalogData.metadata.solutionCount,
        cached: true,
      });

      // 5. Generate recommendations using Gemini with full catalog (use contextualized message)
      const recommendation =
        await this.langChainService.generateRecommendationsFromCatalog({
          message: contextualizedMessage, // 🔥 Use contextualized message for "no" responses
          catalog: catalogData.flat, // Pass flat array
          context,
        });

      const duration = Date.now() - startTime;

      // 🔍 DIAGNOSTIC: Log Gemini's decision in detail
      this.logger.info("🔍 DIAGNOSTIC: Gemini recommendation raw output", {
        sessionId: session_id,
        solution: recommendation.solution,
        category: recommendation.category,
        recommendedItems: recommendation.recommendedItems.map((item) => ({
          id: item.id,
          name: item.name,
          reason: item.reason,
        })),
        replyPreview: recommendation.reply.substring(0, 200),
        confidence: recommendation.confidence,
      });

      // ✅ CRITICAL: Detect recommendation overlap (should always be 0!)
      const newItemIds = recommendation.recommendedItems.map((item) => item.id);
      const previousItemIds = context.currentRecommendations.map(
        (item) => item.id
      );
      const overlap = newItemIds.filter((id) => previousItemIds.includes(id));

      this.logger.info("🔍 DIAGNOSTIC: Recommendations generated", {
        sessionId: session_id,
        duration,
        newItemCount: recommendation.recommendedItems.length,
        excludedItemCount: context.currentRecommendations.length,
        overlap: overlap.length, // ← Should always be 0!
        overlapIds: overlap.length > 0 ? overlap : undefined, // Log IDs only if there's an issue
        confidence: recommendation.confidence,
        userIntent,
      });

      // 🚨 ALERT: Log warning if repetition detected
      if (overlap.length > 0) {
        this.logger.warn(
          "⚠️ REPETITION DETECTED: Gemini repeated recommendations!",
          {
            sessionId: session_id,
            overlapCount: overlap.length,
            overlapIds: overlap,
            previousItems: context.currentRecommendations.map((i) => ({
              id: i.id,
              name: i.name,
            })),
            newItems: recommendation.recommendedItems.map((i) => ({
              id: i.id,
              name: i.name,
            })),
          }
        );
      }

      // 7. Map recommended items to EnrichedItem for saveTurn
      const enrichedItems: EnrichedItem[] = recommendation.recommendedItems.map(
        (item) => {
          const fullItem = catalogData.flat.find((c) => c.id === item.id);
          return {
            id: item.id,
            name: item.name,
            description: fullItem?.description || null,
            price: fullItem?.price || null,
            contractTerm: fullItem?.contractTerm || null,
            itemType: (fullItem?.type || "product") as
              | "solution"
              | "category"
              | "product",
            parentItem: null, // Would need to look up if needed
            targetAudience: null, // Would need to look up if needed
            features: [],
          };
        }
      );

      // 8. Build response DTO
      // ✅ FIX #5: Correct response DTO format
      const responseDto: ChatResponseDto = {
        reply: recommendation.reply,
        recommended_items: enrichedItems.map((item) => this.mapToItemDto(item)),
        session_id,
        conversation_context: context.conversationStage,
      };

      // 9. Save conversation turn
      // ✅ FIX #3: Correct saveTurn arguments (5 args)
      await this.contextService.saveTurn(
        session_id,
        request,
        responseDto,
        {
          solution: recommendation.solution || undefined, // 🔥 Handle null solution (feedback stage)
          category: recommendation.category || undefined, // 🔥 Handle null category (feedback stage)
        },
        enrichedItems
      );

      return responseDto;
    } catch (error) {
      this.logger.error(
        `Error processing message for session ${session_id}`,
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Detect user intent from message for monitoring and analytics
   * @private
   */
  private detectUserIntent(message: string): string {
    const lowerMsg = message.toLowerCase();

    // User asking for alternatives/more options
    if (
      /what else|other options|alternatives|different|more options/i.test(
        lowerMsg
      )
    ) {
      return "alternatives";
    }

    // User adding to the same topic
    if (/also|in addition|and|plus|as well/i.test(lowerMsg)) {
      return "add_to_topic";
    }

    // User shifting to a different topic
    if (/actually|instead|rather|no|not|change/i.test(lowerMsg)) {
      return "topic_shift";
    }

    // Initial query (default)
    return "initial_query";
  }

  /**
   * Run the entity classifier and apply entity-aware stage promotion.
   * Mutates context in place with entities, stage, and forceCommit.
   * Skips the Gemini classifier call for trivial messages (greetings,
   * confirmations) where extraction adds no value over the ~1.5s budget.
   * @private
   */
  private async extractAndPromoteEntities(
    message: string,
    context: ConversationContext
  ): Promise<void> {
    const entities = await this.extractEntitiesForContext(message, context);
    context.entities = entities;
    this.applyEntityPromotion(context, entities);
  }

  /**
   * Entity extraction only (the Gemini call), split out from stage promotion so
   * it can be run concurrently with topic-switch detection — the two are
   * independent LLM calls. Returns {} for trivial messages without hitting the
   * model (preserving the original short-circuit).
   */
  private async extractEntitiesForContext(
    message: string,
    context: ConversationContext
  ): Promise<ExtractedEntities> {
    const trivial =
      message.length <= 4 || this.isSimpleConfirmation(message);

    if (trivial) {
      return {};
    }

    const recentUserMsgs = context.recentTurns
      .map((t) => t.userMessage)
      .filter((m): m is string => !!m);
    return this.langChainService.extractEntities(message, recentUserMsgs);
  }

  /**
   * Apply conversation-stage promotion from already-extracted entities
   * (synchronous, no LLM call). Entities are passed in explicitly rather than
   * read back off `context` so there is no implicit "set context.entities
   * first" ordering requirement.
   */
  private applyEntityPromotion(
    context: ConversationContext,
    entities: ExtractedEntities
  ): void {
    const promoted = this.contextSelector.promoteStageWithEntities({
      currentStage: context.conversationStage,
      entities,
      turns: context.recentTurns,
    });
    context.conversationStage = promoted.stage;
    context.forceCommit = promoted.forceCommit;
  }

  /**
   * Check if message is a simple confirmation/feedback response
   * Used to prevent topic switch detection from overriding feedback stage
   * @private
   */
  private isSimpleConfirmation(message: string): boolean {
    const lowerMsg = message.toLowerCase().trim();

    // Simple yes/no responses
    const confirmationPatterns = [
      /^yes$/i,
      /^no$/i,
      /^yeah$/i,
      /^yep$/i,
      /^nope$/i,
      /^sure$/i,
      /^ok$/i,
      /^okay$/i,
      /^alright$/i,
      /^good$/i,
      /^great$/i,
      /^perfect$/i,
      /^thanks$/i,
      /^thank you$/i,
      /^that helps?$/i,
      /^that'?s? good$/i,
      /^that'?s? perfect$/i,
      /^that'?s? great$/i,
      /^that works?$/i,
      /^sounds good$/i,
      /^looks good$/i,
      /^not really$/i,
      /^not quite$/i,
      /^not exactly$/i,
    ];

    return confirmationPatterns.some((pattern) => pattern.test(lowerMsg));
  }

  /**
   * Check if message is a positive confirmation (yes, perfect, etc.)
   * Used to trigger deterministic closing response without LLM call
   * @private
   */
  private isPositiveConfirmation(message: string): boolean {
    const lowerMsg = message.toLowerCase().trim();

    // Positive confirmation patterns (excludes negative responses)
    const positivePatterns = [
      /^yes$/i,
      /^yeah$/i,
      /^yep$/i,
      /^sure$/i,
      /^ok$/i,
      /^okay$/i,
      /^alright$/i,
      /^good$/i,
      /^great$/i,
      /^perfect$/i,
      /^thanks$/i,
      /^thank you$/i,
      /^that helps?$/i,
      /^that'?s? good$/i,
      /^that'?s? perfect$/i,
      /^that'?s? great$/i,
      /^that works?$/i,
      /^sounds good$/i,
      /^looks good$/i,
    ];

    return positivePatterns.some((pattern) => pattern.test(lowerMsg));
  }

  /**
   * Check if message is a negative confirmation (no, nope, etc.)
   * Used to detect when user is rejecting recommendations
   * @private
   */
  /**
   * If the user is rejecting a prior recommendation ("no", "nope", …), rewrite
   * the message so the downstream recommender knows to stay inside the same
   * solution and surface alternatives instead of treating "no" as a brand-new
   * query. Called from both processMessage and processMessageStream so the
   * "no" branch works identically on the HTTP and Socket.IO paths.
   */
  private contextualizeNegativeFeedback(
    message: string,
    context: ConversationContext
  ): string {
    const isFeedback = context.conversationStage === "feedback";
    const hasRecommendations = context.currentRecommendations.length > 0;
    if (
      !isFeedback ||
      !hasRecommendations ||
      !this.isSimpleConfirmation(message) ||
      !this.isNegativeConfirmation(message)
    ) {
      return message;
    }

    const topic = this.extractCurrentTopic(context);
    if (!topic.solution) {
      return message;
    }

    const categoryClause = topic.category
      ? ` Previous category was ${topic.category}. You can show alternatives from other ${topic.solution} categories.`
      : "";

    return (
      `The user said "no" to the previous ${topic.solution} recommendations. ` +
      `Please recommend DIFFERENT ${topic.solution} products that were NOT already recommended. ` +
      `Stay within ${topic.solution} - do NOT switch to other solutions.${categoryClause}`
    );
  }

  private isNegativeConfirmation(message: string): boolean {
    const lowerMsg = message.toLowerCase().trim();

    // Negative confirmation patterns
    const negativePatterns = [
      /^no$/i,
      /^nope$/i,
      /^nah$/i,
      /^not really$/i,
      /^not quite$/i,
      /^not exactly$/i,
    ];

    return negativePatterns.some((pattern) => pattern.test(lowerMsg));
  }

  /**
   * Extract current topic (solution/category) from conversation context
   * Used to maintain topic consistency when showing alternatives
   * @private
   */
  private extractCurrentTopic(context: ConversationContext): {
    solution: string | null;
    category: string | null;
  } {
    // Try to get from most recent turn's extracted entities
    if (context.recentTurns.length > 0) {
      const lastTurn = context.recentTurns[context.recentTurns.length - 1];
      const entities = lastTurn.extractedEntities;

      if (entities?.solution || entities?.category) {
        return {
          solution: entities.solution || null,
          category: entities.category || null,
        };
      }
    }

    // Try to infer from current recommendations
    if (context.currentRecommendations.length > 0) {
      // For now, we don't have direct access to solution/category from items
      // This would need to be enhanced based on your data structure
      return {
        solution: null,
        category: null,
      };
    }

    return {
      solution: null,
      category: null,
    };
  }
}
