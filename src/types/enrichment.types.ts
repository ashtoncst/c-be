// src/types/enrichment.types.ts

import type { ExtractedEntitiesDto } from "../dtos/chat.dto.js";
import type { SolutionName } from "./catalog.types.js";

/**
 * Enrichment pattern configuration
 * Defines rules for enriching entities based on message patterns
 */
export interface EnrichmentPattern {
	id: string;
	priority: number;
	description: string;
	trigger:
		| RegExp
		| ((msg: string, entities: Partial<ExtractedEntitiesDto>) => boolean);
	enrich: (
		msg: string,
		entities: Partial<ExtractedEntitiesDto>
	) => Partial<ExtractedEntitiesDto>;
}

/**
 * Catalog item for validation
 */
export interface CatalogItem {
	id: number;
	name: string;
	type: "solution" | "category" | "product";
	parentId?: number;
}

/**
 * Synonym maps for normalization
 */
export interface SynonymMap {
	solution: Record<string, SolutionName>;
	category: Record<string, string>;
	product: Record<string, string>;
}

/**
 * Enriched entities with confidence
 */
export type EnrichedEntities = ExtractedEntitiesDto & {
	confidence_level?: "high" | "medium" | "low";
};

/**
 * Configuration for entity enrichment service
 */
export interface EntityEnrichmentConfig {
	patterns: EnrichmentPattern[];
	synonyms: SynonymMap;
	enableCaching?: boolean;
	cacheTimeout?: number;
}
