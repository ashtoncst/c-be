import { db } from "../db/index.js";
import { item } from "../models/schema.model.js";
import { eq } from "drizzle-orm";
import type {
	CatalogItem,
	CatalogData,
	SolutionWithChildren,
} from "../types/catalog.types.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "CatalogCacheService" });

/**
 * Singleton service for caching product catalog
 * Caches both flat and hierarchical formats to avoid rebuilding on every request
 * Reduces DB queries from 3-5 per message to 1 per 5 minutes
 */
export class CatalogCacheService {
	private static instance: CatalogCacheService;
	private cachedData: CatalogData | null = null;
	private lastFetch: Date | null = null;
	private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

	private constructor() {
		try {
			logger?.info("CatalogCacheService initialized");
		} catch {
			// Silent fail if logger not available (e.g., in tests)
		}
	}

	/**
	 * Get singleton instance
	 */
	static getInstance(): CatalogCacheService {
		if (!CatalogCacheService.instance) {
			CatalogCacheService.instance = new CatalogCacheService();
		}
		return CatalogCacheService.instance;
	}

	/**
	 * Get catalog in both flat and hierarchical formats
	 * Both formats are cached together to avoid rebuilding hierarchy
	 * Caches for 5 minutes to balance freshness vs performance
	 */
	async getCatalog(): Promise<CatalogData> {
		const now = new Date();
		const isCacheValid =
			this.cachedData &&
			this.lastFetch &&
			now.getTime() - this.lastFetch.getTime() < this.CACHE_TTL_MS;

		if (isCacheValid) {
			try {
				logger?.debug("✅ Using cached catalog (flat + hierarchical)");
			} catch {
				// Silent fail if logger not available
			}
			return this.cachedData!;
		}

		try {
			logger?.info("🔄 Fetching fresh catalog from database...");
		} catch {
			// Silent fail if logger not available
		}

		// Fetch flat catalog from DB
		const flatItems = await db
			.select({
				id: item.id,
				name: item.name,
				description: item.description,
				type: item.itemType,
				parentId: item.parentItemId,
				price: item.price,
				contractTerm: item.contractTerm,
				targetAudienceId: item.targetAudienceId,
			})
			.from(item)
			.where(eq(item.isActive, true))
			.orderBy(item.itemType, item.id);

		// Build hierarchical structure ONCE
		const hierarchicalItems = this.buildHierarchy(flatItems as CatalogItem[]);

		// Calculate metadata
		const metadata = {
			itemCount: flatItems.length,
			solutionCount: flatItems.filter((i) => i.type === "solution").length,
			categoryCount: flatItems.filter((i) => i.type === "category").length,
			productCount: flatItems.filter((i) => i.type === "product").length,
			lastRefresh: now,
		};

		// Cache both formats together
		this.cachedData = {
			flat: flatItems as CatalogItem[],
			hierarchical: hierarchicalItems,
			metadata,
		};
		this.lastFetch = now;

		try {
			logger?.info(
				`✅ Loaded ${flatItems.length} items (${metadata.solutionCount} solutions, ${metadata.categoryCount} categories, ${metadata.productCount} products)`
			);
		} catch {
			// Silent fail if logger not available
		}

		return this.cachedData;
	}

	/**
	 * Force refresh cache (rebuilds both flat and hierarchical)
	 */
	async refreshCache(): Promise<void> {
		try {
			logger?.info("🔄 Force refreshing catalog cache...");
		} catch {
			// Silent fail if logger not available
		}
		this.cachedData = null;
		this.lastFetch = null;
		await this.getCatalog();
	}

	/**
	 * Build hierarchical view for better Gemini prompting
	 * Organizes: solutions → categories → products
	 */
	buildHierarchy(catalog: CatalogItem[]): SolutionWithChildren[] {
		const solutions = catalog.filter((i) => i.type === "solution");
		return solutions.map((sol) => ({
			id: sol.id,
			name: sol.name,
			description: sol.description,
			type: "solution" as const,
			categories: catalog
				.filter((c) => c.type === "category" && c.parentId === sol.id)
				.map((cat) => ({
					id: cat.id,
					name: cat.name,
					description: cat.description,
					type: "category" as const,
					parentId: cat.parentId!,
					products: catalog
						.filter((p) => p.type === "product" && p.parentId === cat.id)
						.map((p) => ({
							id: p.id,
							name: p.name,
							description: p.description,
							type: "product" as const,
							parentId: p.parentId!,
							price: p.price,
							contractTerm: p.contractTerm,
						})),
				})),
		}));
	}

	/**
	 * Get cache statistics (enhanced with hierarchy info)
	 */
	getCacheStats() {
		return {
			isCached: this.cachedData !== null,
			itemCount: this.cachedData?.metadata.itemCount ?? 0,
			solutionCount: this.cachedData?.metadata.solutionCount ?? 0,
			categoryCount: this.cachedData?.metadata.categoryCount ?? 0,
			productCount: this.cachedData?.metadata.productCount ?? 0,
			lastFetch: this.lastFetch?.toISOString() ?? null,
			ttlMs: this.CACHE_TTL_MS,
			expiresAt: this.lastFetch
				? new Date(this.lastFetch.getTime() + this.CACHE_TTL_MS).toISOString()
				: null,
		};
	}
}
