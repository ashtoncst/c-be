// src/types/context.types.ts

/**
 * Context merging strategy based on message analysis
 */
export type MergeStrategy =
	| "affirmation" // "yes", "continue" - carry all previous entities
	| "negation" // "no", "nope" - clear context
	| "topic_shift" // New topic detected - don't merge
	| "normal_merge"; // Carry forward solution/category if missing

/**
 * Context carry decision with reasoning
 */
export interface ContextCarryDecision {
	shouldCarry: boolean;
	strategy: MergeStrategy;
	reason: string;
}

/**
 * Conversation stage based on turn count and content
 */
export type ConversationStage =
	| "greeting" // Initial message
	| "discovery" // First 1-2 turns, exploring needs
	| "refinement" // 3-5 turns, narrowing down
	| "recommendation" // Has recommendations, discussing options
	| "feedback" // Post-recommendation, awaiting user confirmation
	| "closing" // Extended conversation, wrapping up
	| "goodbye"; // Final goodbye after user says "no" to "anything else?"

/**
 * Context loading options
 */
export interface ContextLoadOptions {
	maxTurns?: number; // Max recent turns to load (default: 5)
	loadRecommendations?: boolean; // Load previous recommendations (default: true)
	loadPreferences?: boolean; // Load user preferences (default: true)
}

/**
 * Context merge options
 */
export interface ContextMergeOptions {
	forceStrategy?: MergeStrategy; // Override automatic detection
	preserveArrays?: boolean; // Merge arrays instead of replacing (default: true)
}
