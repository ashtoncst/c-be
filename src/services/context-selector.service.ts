/**
 * ContextSelector: AI-Based Context Selection & Stage Detection
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * RESPONSIBILITIES:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ Select optimal conversation turns using AI relevance scoring
 * ✅ Summarize older turns to reduce token usage
 * ✅ Determine conversation stage based on history and patterns
 * ✅ Detect query type (follow-up, comparison, new topic, etc.)
 * ✅ Orchestrate: RelevanceScorer, ContextSummarizer, TurnSelector
 *
 * ❌ Does NOT handle database operations (handled by ContextService)
 * ❌ Does NOT format messages for Gemini (handled by ContextFormatter)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * STAGE DETECTION LOGIC (SOURCE OF TRUTH):
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This service is the SINGLE SOURCE OF TRUTH for conversation stage detection.
 * Stage detection happens in determineConversationStage() (line 180).
 *
 * Stages detected:
 * - greeting: No conversation history
 * - feedback: Bot asked "Does that answer your question?" in last response
 * - recommendation: Has recommendations but no feedback prompt
 * - refinement: 5+ turns of conversation
 * - discovery: Default state for new queries
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * USAGE:
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * // Called by ContextService.loadIntelligentContext():
 * const context = await this.contextSelector.selectContext({
 *   query: currentMessage,
 *   allTurns: conversationHistory,
 *   userPreferences,
 *   currentRecommendations
 * });
 *
 * // Returns: { recentTurns, conversationStage, ... }
 */

import type {
	ConversationContext,
	ConversationTurn,
	EnrichedItem,
	ExtractedEntities,
} from "../dtos/chat.dto.js";
import type {
	IntelligentContextOptions,
	QueryType,
	SelectionStrategy,
} from "../types/intelligent-context.types.js";
import CONTEXT_CONFIG from "../config/context.config.js";
import { ConversationStage } from "../types/context.types.js";
import { RelevanceScorer } from "./relevance-scorer.service.js";
import { ContextSummarizer } from "./context-summarizer.service.js";
import { TurnSelector } from "./turn-selector.service.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

/**
 * ContextSelector
 *
 * Fully integrated intelligent context selection with all services
 */
export class ContextSelector {
	private relevanceScorer!: RelevanceScorer;
	private contextSummarizer!: ContextSummarizer;
	private turnSelector: TurnSelector;
	private geminiClient: ChatGoogleGenerativeAI | null = null;
	private isInitialized = false;

	constructor() {
		// Lazy initialization - only create Gemini client when actually needed
		// This prevents startup errors when API key is missing
		this.turnSelector = new TurnSelector();
	}

	/**
	 * Initialize Gemini client and dependent services (lazy initialization)
	 * @private
	 */
	private initializeGeminiServices(): void {
		if (this.isInitialized) return;

		try {
			// Check if API key is available
			const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

			if (!apiKey) {
				console.warn(
					"[ContextSelector] Google Gemini API key not found. " +
						"Intelligent context selection will use fallback mode. " +
						"Set GOOGLE_GEMINI_API_KEY environment variable."
				);
				this.isInitialized = true;
				return;
			}

			// Initialize Gemini client
			this.geminiClient = new ChatGoogleGenerativeAI({
				model: CONTEXT_CONFIG.scoring.model,
				temperature: CONTEXT_CONFIG.scoring.temperature,
				apiKey,
			});

			// Initialize services that depend on Gemini
			this.relevanceScorer = new RelevanceScorer(this.geminiClient);
			this.contextSummarizer = new ContextSummarizer(this.geminiClient);

			this.isInitialized = true;
		} catch (error) {
			console.error(
				"[ContextSelector] Failed to initialize Gemini services:",
				error
			);
			this.isInitialized = true; // Mark as initialized to prevent retry loops
		}
	}

	/**
	 * Select optimal context for current query
	 *
	 * @param options - Query, conversation history, preferences, recommendations
	 * @returns Optimized conversation context
	 */
	async selectContext(
		options: IntelligentContextOptions
	): Promise<ConversationContext> {
		// Initialize Gemini services if not already done
		this.initializeGeminiServices();

		const { query, allTurns, userPreferences, currentRecommendations } =
			options;

		// Handle empty conversation
		if (allTurns.length === 0) {
			return {
				recentTurns: [],
				userPreferences: userPreferences || {},
				currentRecommendations: currentRecommendations || [],
				conversationStage: "discovery",
			};
		}

		// If Gemini services are not available, use simple fallback
		if (
			!this.geminiClient ||
			!this.relevanceScorer ||
			!this.contextSummarizer
		) {
			return this.simpleFallbackContext(
				allTurns,
				userPreferences || {},
				currentRecommendations || []
			);
		}

		// Step 1: Detect query type
		const queryType = await this.detectQueryType(query, allTurns);

		// Step 2: Get selection strategy for query type
		const strategy = this.getStrategyForQueryType(queryType);

		// Step 3: Score turn relevance
		const relevanceScores = await this.relevanceScorer.scoreBatch(
			query,
			allTurns
		);

		// Step 4: Select optimal turns based on strategy
		const selectedTurns = this.turnSelector.selectOptimalTurns(
			allTurns,
			relevanceScores,
			strategy
		);

		// Step 5: Apply summarization if needed
		let conversationSummary: string | undefined;
		if (allTurns.length > CONTEXT_CONFIG.summarization.triggerAfterTurns) {
			// Summarize older turns (those not in selected turns)
			const selectedIndices = new Set(
				selectedTurns.map((turn) => allTurns.indexOf(turn))
			);
			const olderTurns = allTurns.filter((_, idx) => !selectedIndices.has(idx));

			if (olderTurns.length > 0) {
				conversationSummary = await this.contextSummarizer.summarizeTurns(
					olderTurns,
					"compressed"
				);
			}
		}

		// Step 6: Determine conversation stage
		const conversationStage = this.determineConversationStage(
			selectedTurns,
			currentRecommendations || []
		);

		// 🔥 NEW: If conversation was closed, clear recommendations for fresh start
		const shouldClearRecommendations =
			conversationStage === "greeting" &&
			selectedTurns.length > 0 &&
			selectedTurns[selectedTurns.length - 1]?.botResponse
				?.toLowerCase()
				.includes("have a great day");

		return {
			recentTurns: selectedTurns,
			userPreferences: {
				...userPreferences,
				conversationSummary,
			},
			currentRecommendations: shouldClearRecommendations
				? []
				: currentRecommendations || [],
			conversationStage: conversationStage as ConversationStage,
		};
	}

	/**
	 * 🎯 SINGLE SOURCE OF TRUTH: Conversation Stage Detection
	 *
	 * This method is the ONLY place where conversation stage is determined.
	 * All other services (ContextService, ContextFormatter, LangChainService) use
	 * the stage determined here.
	 *
	 * Stage Detection Rules (in priority order):
	 * 1. greeting: No conversation history (turns.length === 0) OR last turn was a goodbye message
	 * 2. closing: Bot asked "Is there anything else I can help you with today?"
	 * 3. feedback: Bot asked "Does that answer your question?" in last response
	 * 4. recommendation: Has recommendations but no feedback prompt
	 * 5. refinement: 5+ turns of conversation
	 * 6. discovery: Default state for new queries
	 *
	 * 🔥 FIX (Nov 17, 2025): Now properly detects feedback stage to prevent
	 * incorrect recommendation regeneration when user says "yes"
	 * 
	 * 🔥 FIX (Nov 20, 2025): Added closing stage detection to properly handle
	 * conversation ending when user says "no" after "Is there anything else?"
	 * 
	 * 🔥 FIX (Nov 20, 2025): Reset to greeting stage after conversation closes
	 * to allow users to start fresh conversations in the same session
	 *
	 * @param turns - Selected conversation turns
	 * @param recommendations - Current recommendations
	 * @returns Conversation stage
	 */
	private determineConversationStage(
		turns: Array<{ userMessage: string; botResponse: string }>,
		recommendations: Array<unknown>
	): string {
		if (turns.length === 0) {
			return "greeting";
		}

		const lastTurn = turns[turns.length - 1];

		// 🔥 NEW: Check if conversation was closed (bot said goodbye)
		// If so, treat any new message as a fresh start
		if (lastTurn) {
			const conversationWasClosed =
				lastTurn.botResponse
					?.toLowerCase()
					.includes("thank you for chatting with me today") ||
				lastTurn.botResponse?.toLowerCase().includes("have a great day");

			if (conversationWasClosed) {
				// User is starting a new conversation after closing
				// Reset to greeting/discovery stage
				return "greeting";
			}
		}

		// 🔥 NEW: Check for closing stage (bot asked "Is there anything else?")
		if (lastTurn) {
			const botAskedForAdditionalHelp = lastTurn.botResponse
				?.toLowerCase()
				.includes("is there anything else i can help you with today");

			if (botAskedForAdditionalHelp) {
				return "closing";
			}
		}

		// Feedback stage: recommendations have been shown AND the bot is
		// awaiting user confirmation. We detect this liberally because Gemini,
		// few-shot replies, and the deterministic fallback (langchain.service.ts)
		// all use different confirmation phrasings. Common shapes:
		//   - "Does that answer your question?" (canonical)
		//   - "Want to see alternatives or compare options?" (fallback committal)
		//   - "Which direction fits best — metro or remote…?" (fallback discovery)
		//   - "Would you like a quote?" (Gemini variants)
		// Any trailing "?" after a recommendation is treated as feedback so the
		// deterministic "yes" closing flow (GlobalBusiness@convergeict.com) fires.
		if (recommendations.length > 0 && lastTurn) {
			const reply = lastTurn.botResponse?.trim() ?? "";
			const replyLower = reply.toLowerCase();

			const explicitPrompts = [
				"does that answer your question",
				"want to see alternatives",
				"compare options",
				"metro or remote",
				"would you like a quote",
				"any questions",
			];
			const hasExplicitPrompt = explicitPrompts.some((p) =>
				replyLower.includes(p)
			);

			// Any reply ending with a question mark after recommendations is an
			// implicit feedback prompt.
			const endsWithQuestion = reply.endsWith("?");

			if (hasExplicitPrompt || endsWithQuestion) {
				return "feedback";
			}

			// Bot made a statement with no follow-up — still exploring.
			return "recommendation";
		}

		if (turns.length >= 5) {
			return "refinement";
		}

		return "discovery";
	}

	/**
	 * Entity-aware stage promotion.
	 *
	 * Called from ChatService AFTER extractEntities() has run. Given the
	 * stage already computed by determineConversationStage() plus the
	 * extracted entities, decide whether to promote the conversation to
	 * "recommendation" and whether to set forceCommit.
	 *
	 * Rules:
	 * - Preserve terminal stages: greeting, feedback, closing, goodbye.
	 * - If ≥2 of {category, industry, size} present → promote to "recommendation".
	 * - If the previous bot turn asked the gating triplet AND the user
	 *   supplied ANY entity → promote + forceCommit.
	 * - If the last two bot responses are byte-identical (pathological loop
	 *   from the old hardcoded fallback) → forceCommit regardless.
	 */
	promoteStageWithEntities(params: {
		currentStage: ConversationStage;
		entities: ExtractedEntities;
		turns: Array<{ userMessage: string; botResponse: string }>;
	}): { stage: ConversationStage; forceCommit: boolean } {
		const { currentStage, entities, turns } = params;

		const locked: ReadonlySet<ConversationStage> = new Set<ConversationStage>([
			"greeting",
			"feedback",
			"closing",
			"goodbye",
		]);
		if (locked.has(currentStage)) {
			return { stage: currentStage, forceCommit: false };
		}

		const lastBot = turns[turns.length - 1]?.botResponse ?? "";
		const prevBot = turns[turns.length - 2]?.botResponse ?? "";

		const byteIdenticalLoop =
			lastBot.length > 0 && lastBot === prevBot;

		const askedGatingTriplet = lastBot
			.toLowerCase()
			.includes("industry, size, main use case");

		const entityCount = [entities.category, entities.industry, entities.size]
			.filter(Boolean).length;

		const anyEntity = entityCount > 0;

		if (byteIdenticalLoop) {
			return { stage: "recommendation", forceCommit: true };
		}

		if (askedGatingTriplet && anyEntity) {
			return { stage: "recommendation", forceCommit: true };
		}

		if (entityCount >= 2 && entities.category) {
			return { stage: "recommendation", forceCommit: false };
		}

		return { stage: currentStage, forceCommit: false };
	}

	/**
	 * Detect query type (stub for Phase 4)
	 *
	 * This will be fully implemented in Phase 4 with Gemini-based classification
	 *
	 * @param query - Current user query
	 * @param turns - Recent conversation turns
	 * @returns Query type
	 */
	private async detectQueryType(
		query: string,
		turns: Array<{ userMessage: string; botResponse: string }>
	): Promise<QueryType> {
		// Stub implementation: Basic pattern matching
		// Will be replaced with Gemini classification in Phase 4

		const lowerQuery = query.toLowerCase();

		// Follow-up patterns
		if (
			lowerQuery.includes("tell me more") ||
			lowerQuery.includes("what about") ||
			lowerQuery.includes("and that")
		) {
			return "follow_up" as QueryType;
		}

		// Comparison patterns
		if (
			lowerQuery.includes("difference") ||
			lowerQuery.includes("compare") ||
			lowerQuery.includes("vs") ||
			lowerQuery.includes("versus")
		) {
			return "comparison" as QueryType;
		}

		// New topic if conversation exists
		if (turns.length > 0 && lowerQuery.includes("actually")) {
			return "new_topic" as QueryType;
		}

		// Default to product search
		return "product_search" as QueryType;
	}

	/**
	 * Get selection strategy for query type
	 *
	 * @param queryType - Detected query type
	 * @returns Selection strategy
	 */
	private getStrategyForQueryType(queryType: QueryType): SelectionStrategy {
		const baseStrategy: SelectionStrategy = {
			alwaysInclude: {
				recentCount: 2,
				currentRecommendations: true,
			},
			relevanceThreshold: CONTEXT_CONFIG.relevanceThreshold,
			maxTurns: CONTEXT_CONFIG.maxTurns,
			tokenBudget: CONTEXT_CONFIG.tokenBudget.availableForContext,
		};

		// Adjust strategy based on query type
		switch (queryType) {
			case "follow_up":
				return {
					...baseStrategy,
					alwaysInclude: { ...baseStrategy.alwaysInclude, recentCount: 3 },
					relevanceThreshold: 8.0, // High threshold for follow-up
				};

			case "comparison":
				return {
					...baseStrategy,
					maxTurns: 4,
					relevanceThreshold: 7.0,
				};

			case "product_search":
				return {
					...baseStrategy,
					maxTurns: 5,
					relevanceThreshold: 6.0,
				};

			case "new_topic":
				return {
					...baseStrategy,
					maxTurns: 5,
					relevanceThreshold: 4.0, // Lower threshold for new topic
				};

			case "clarification":
				return {
					...baseStrategy,
					alwaysInclude: { ...baseStrategy.alwaysInclude, recentCount: 4 },
					relevanceThreshold: 7.0,
				};

			default:
				return baseStrategy;
		}
	}

	/**
	 * Simple fallback when Gemini services are not available
	 * Returns last N turns without intelligent selection
	 *
	 * @param allTurns - All conversation turns
	 * @param userPreferences - User preferences
	 * @param currentRecommendations - Current recommendations
	 * @returns Simple context with recent turns
	 * @private
	 */
	private simpleFallbackContext(
		allTurns: ConversationTurn[],
		userPreferences: Record<string, unknown>,
		currentRecommendations: EnrichedItem[]
	): ConversationContext {
		// Simple fallback: use last 5 turns
		const recentTurns = allTurns.slice(-5);

		// Determine stage based on recommendations and turn count
		// Priority: empty > recommendations > turn count
		let conversationStage: ConversationStage = "discovery";
		if (allTurns.length === 0) {
			conversationStage = "greeting";
		} else if (currentRecommendations.length > 0) {
			// Check for feedback prompt in last turn
			const lastTurn = allTurns[allTurns.length - 1];
			const botAskedForConfirmation = lastTurn?.botResponse
				?.toLowerCase()
				.includes("does that answer your question");
			conversationStage = botAskedForConfirmation
				? "feedback"
				: "recommendation";
		} else if (allTurns.length >= 5) {
			conversationStage = "refinement";
		} else {
			conversationStage = "discovery";
		}

		return {
			recentTurns,
			userPreferences,
			currentRecommendations,
			conversationStage,
		};
	}
}
