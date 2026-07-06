/**
 * @deprecated Solution names are now just strings. This type is kept for backward compatibility.
 * Use string directly instead.
 */
export type SolutionName = string;

/**
 * @deprecated This type is used by the deprecated CatalogMappingService.
 * Kept for backward compatibility. Will be removed in Q2 2026.
 */
export interface CatalogMapping {
	solutions: Record<
		string,
		{ categories: Record<string, { products: string[] }> }
	>;
	productToCategory: Record<string, string>;
	categoryToSolution: Record<string, string>;
	synonyms: {
		solution: Record<string, string>;
		category: Record<string, string>;
		product: Record<string, unknown>;
	};
}

/**
 * Catalog item as loaded from database
 */
export interface CatalogItem {
	id: number;
	name: string;
	description: string | null;
	type: "solution" | "category" | "product";
	parentId: number | null;
	price: string | null;
	contractTerm: string | null;
	targetAudienceId: number | null;
}

/**
 * Hierarchical catalog structure for Gemini prompts
 */
export interface HierarchicalCatalog {
	solutions: SolutionWithChildren[];
}

export interface SolutionWithChildren {
	id: number;
	name: string;
	description: string | null;
	type: "solution";
	categories: CategoryWithChildren[];
}

export interface CategoryWithChildren {
	id: number;
	name: string;
	description: string | null;
	type: "category";
	parentId: number;
	products: ProductItem[];
}

export interface ProductItem {
	id: number;
	name: string;
	description: string | null;
	type: "product";
	parentId: number;
	price: string | null;
	contractTerm: string | null;
}

/**
 * Complete catalog data with both flat and hierarchical formats
 * Used by CatalogCacheService to avoid rebuilding hierarchy on every request
 */
export interface CatalogData {
	flat: CatalogItem[];
	hierarchical: SolutionWithChildren[];
	metadata: CatalogMetadata;
}

/**
 * Metadata about the cached catalog
 */
export interface CatalogMetadata {
	itemCount: number;
	solutionCount: number;
	categoryCount: number;
	productCount: number;
	lastRefresh: Date;
}

/**
 * Enhanced response from Gemini with catalog-based recommendations
 * 🔥 FIX: solution and category can be null/undefined in feedback stage
 * This prevents type errors when Gemini returns sparse responses for confirmations
 */
export interface CatalogBasedRecommendation {
	solution: string | null | undefined;
	category: string | null | undefined;
	recommendedItems: RecommendedItem[];
	reply: string;
	confidence: number;
}

export interface RecommendedItem {
	id: number;
	name: string;
	reason: string;
}
