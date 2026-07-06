// src/dtos/chat.dto.ts
import {
	IsString,
	IsNotEmpty,
	IsOptional,
	IsArray,
	IsObject,
	IsNumber,
	MaxLength,
} from "class-validator";
import { Expose, Type } from "class-transformer";
import { SolutionName } from "../types/catalog.types.js";
import { ItemDto } from "./item.dto.js";

export class ChatRequestDto {
	@IsString()
	@IsNotEmpty()
	@Expose()
	session_id!: string; // Auto-generated in WebSocket handler if missing

	@IsString()
	@IsNotEmpty()
	@MaxLength(2000)
	@Expose()
	message!: string;
}

/**
 * @deprecated Use ItemDto from item.dto.ts instead
 * Kept for backward compatibility with existing API consumers
 */
export class ProductRecommendationDto {
	@IsString()
	@Expose()
	id!: string;

	@IsString()
	@Expose()
	name!: string;

	@IsString()
	@IsOptional()
	@Expose()
	description?: string | null;

	@IsString()
	@IsOptional()
	@Expose()
	price?: string | null;

	@IsString()
	@IsOptional()
	@Expose()
	contract_term?: string | null;

	@IsString()
	@Expose()
	target_audience!: string;

	@IsString()
	@Expose()
	product_category!: string;

	@IsArray()
	@IsOptional()
	@Expose()
	features?: string[];
}

export class ChatResponseDto {
	@IsString()
	@Expose()
	reply!: string;

	@IsArray()
	@IsOptional()
	@Type(() => ItemDto)
	@Expose()
	recommended_items?: ItemDto[];

	@IsString()
	@Expose()
	session_id!: string;

	@IsString()
	@IsOptional()
	@Expose()
	conversation_context?: string | null;

	@IsArray()
	@IsOptional()
	@Type(() => TierGroupDto)
	@Expose()
	recommendations_by_tier?: TierGroupDto[];

	@IsArray()
	@IsOptional()
	@Type(() => TemplateGroupDto)
	@Expose()
	recommendations_by_template?: TemplateGroupDto[];

	@IsArray()
	@IsOptional()
	@Type(() => CategoryRecommendationDto)
	@Expose()
	recommended_categories?: CategoryRecommendationDto[];

	@IsObject()
	@IsOptional()
	@Expose()
	decision_trace?: DecisionTraceDto;
}

export class TierGroupDto {
	@IsString()
	@Expose()
	tier!: "small" | "medium" | "large";

	@IsArray()
	@Type(() => ItemDto)
	@Expose()
	items!: ItemDto[];

	@IsString()
	@IsOptional()
	@Expose()
	summary?: string;
}

export class TemplateGroupDto {
	@IsString()
	@Expose()
	rationale!: string;

	@IsArray()
	@Type(() => ItemDto)
	@Expose()
	items!: ItemDto[];
}

// For LangChain entity extraction
export class ExtractedEntitiesDto {
	@IsArray()
	@IsOptional()
	@Expose()
	features?: string[];

	@IsString()
	@IsOptional()
	@Expose()
	target_audience?: string;

	@IsString()
	@IsOptional()
	@Expose()
	product_category?: string; // Backward compatibility

	@IsString()
	@IsOptional()
	@Expose()
	solution?: string; // New: top-level solution

	@IsString()
	@IsOptional()
	@Expose()
	category?: string; // New: category within solution

	// 🆕 Ranked solution candidates from deterministic scorer
	@IsArray()
	@IsOptional()
	@Expose()
	solution_candidates?: Array<{ name: SolutionName; score: number }>;

	// 🆕 Ranked category candidates limited to the detected solution
	@IsArray()
	@IsOptional()
	@Expose()
	category_candidates?: Array<{ name: string; score: number }>;

	// 🆕 Recommendation mode decision
	@IsString()
	@IsOptional()
	@Expose()
	recommendation_mode?: "category_discovery" | "product_recommendation";

	@IsString()
	@IsOptional()
	@Expose()
	price_range?: string;

	@IsString()
	@IsOptional()
	@Expose()
	intent?: string; // e.g., "product_search", "pricing_inquiry", "comparison"

	@IsString()
	@IsOptional()
	@Expose()
	information_completeness?: "complete" | "partial" | "minimal"; // Assess if user provided enough info

	// Number of users/devices (pax)
	@IsNumber()
	@IsOptional()
	@Type(() => Number)
	@Expose()
	num_users?: number;

	// Primary use cases (e.g., pos, customer_wifi, inventory, cctv)
	@IsArray()
	@IsOptional()
	@Expose()
	primary_use?: string[];

	// 🆕 NEW FIELDS for fast recommendations
	// Inferred business size from context (rooms, employees, branches)
	@IsString()
	@IsOptional()
	@Expose()
	contextual_scale?: "small" | "medium" | "large";

	// How confident we are in the extracted information
	@IsString()
	@IsOptional()
	@Expose()
	confidence_level?: "high" | "medium" | "low";

	// Predicted solutions/categories based on industry patterns
	@IsArray()
	@IsOptional()
	@Expose()
	inferred_needs?: string[];

	// From industry templates (what this industry typically needs)
	@IsArray()
	@IsOptional()
	@Expose()
	typical_needs?: string[];

	// User indicated urgency - skip discovery and show best-sellers
	@IsOptional()
	@Expose()
	skip_discovery?: boolean;

	// 🆕 Predicted exact products from inference
	@IsArray()
	@IsOptional()
	@Expose()
	predicted_products?: string[];

	// 🆕 Budget indication amount
	@IsNumber()
	@IsOptional()
	@Type(() => Number)
	@Expose()
	budget_indication?: number;

	// 🆕 Competitive context
	@IsOptional()
	@Expose()
	competitive_context?: {
		currentProvider?: string;
		painPoints?: string[];
	};

	// 🆕 Technical requirements
	@IsOptional()
	@Expose()
	technical_requirement?: string;
}

/**
 * Represents a fully detailed item (solution, category, or product), including parent, audience, and features.
 * This is used internally between services to pass rich item data.
 *
 * Note: parentItem represents the item's parent in the hierarchy:
 * - For products: parentItem is the category
 * - For categories: parentItem is the solution
 * - For solutions: parentItem is null
 */
export interface EnrichedItem {
	id: number;
	name: string;
	description: string | null;
	price: string | null;
	contractTerm: string | null;
	itemType: "solution" | "category" | "product"; // Actual item types used in the database
	parentItem: {
		id: number;
		name: string;
		description: string | null;
		itemType?: "solution" | "category" | "product"; // Parent's type
	} | null;
	targetAudience: {
		id: number;
		name: string;
		description: string | null;
	} | null;
	features: { id: number; name: string; description: string | null }[];
}

/**
 * @deprecated Use EnrichedItem instead
 * Kept temporarily for backward compatibility during refactoring
 */
export type EnrichedProduct = EnrichedItem;

// Optional reasoning trace for debugging/tests (behind DEBUG_REASONING)
export interface DecisionTraceDto {
	extracted: { solution?: string; category?: string; audience?: string };
	intentFocus?: {
		focus: "hospitality" | "internet" | "transport" | "content" | "security";
		score: number;
		cues: string[];
	};
	searchHints: {
		excludedIds: number[];
		strictToSolution: boolean;
		categoryKeywords: string[];
	};
	candidates: string[];
	final: string[];
}

/**
 * Represents a single turn in a conversation.
 */
export interface ConversationTurn {
	userMessage: string;
	botResponse: string;
	timestamp: Date;
	extractedEntities?: ExtractedEntitiesDto; // ✅ ADDED: To carry over past entities
}

/**
 * The full context of a conversation, including history, user preferences,
 * and the current state of recommendations.
 */
export interface ExtractedEntities {
	category?: string;
	industry?: string;
	size?: string;
}

export interface ConversationContext {
	recentTurns: ConversationTurn[];
	userPreferences: Record<string, unknown>; // Use 'unknown' for type safety over 'any'
	currentRecommendations: EnrichedItem[];
	conversationStage:
		| "greeting"
		| "discovery"
		| "refinement"
		| "recommendation"
		| "closing"
		| "feedback"
		| "goodbye";
	entities?: ExtractedEntities;
	forceCommit?: boolean;
}
export class CategoryRecommendationDto {
	@IsString()
	@Expose()
	id!: string;

	@IsString()
	@Expose()
	name!: string;

	@IsString()
	@IsOptional()
	@Expose()
	description?: string | null;
}

export class ChatContextDto {
	@IsString()
	@Expose()
	session_id!: string;

	@IsArray()
	@IsOptional()
	@Expose()
	conversation_history?: Array<{
		role: "user" | "assistant";
		message: string;
		timestamp: Date;
	}>;

	@IsObject()
	@IsOptional()
	@Expose()
	user_preferences?: Record<string, string | number | boolean | null>;
}
