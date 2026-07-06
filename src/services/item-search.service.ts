// src/services/item-search.service.ts

/**
 * ItemSearchService: Handles searching for items (solutions, categories, products) in the database
 *
 * Supports multiple search strategies:
 * - Search by names: Direct lookup by solution/category/product names
 * - Search by entities: Uses extracted entities (needs, scale, audience) to find matches
 * - Full-text search: PostgreSQL FTS for broader semantic matching
 * - Specialized searches: VPN products, alternative recommendations
 *
 * Features:
 * - Scoring and ranking based on text match, exact match, audience match, item type relevance
 * - Keyword relevance boosting
 * - Speculative recommendations (when strict matching fails)
 * - Exclusion of already-shown items
 *
 * Note: Being consolidated into ProductMatchingService for cleaner architecture.
 */

import { db } from "../db/index.js";
import { eq, and, or, ilike, notInArray, SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { item, targetAudience } from "../models/schema.model.js";
import { ExtractedEntitiesDto, EnrichedItem } from "../dtos/chat.dto.js";
import { Logger } from "../utils/logger.js";

interface ScoredItem {
  item: EnrichedItem;
  score: number;
  scoreBreakdown: {
    textMatch: number;
    exactMatch: number;
    audienceMatch: number;
    itemTypeRelevance: number;
    keywordRelevance: number;
  };
}

export class ItemSearchService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ serviceName: "ItemSearchService" });
  }

  // Helper: get categories under a solution (by name)
  public async getCategoriesUnderSolution(
    solutionName: string,
    limit = 6
  ): Promise<EnrichedItem[]> {
    const parentSolution = alias(item, "solutionItem");
    const rows = await db
      .select({
        id: item.id,
        name: item.name,
        description: item.description,
        itemType: item.itemType,
      })
      .from(item)
      .leftJoin(parentSolution, eq(item.parentItemId, parentSolution.id))
      .where(
        and(
          eq(item.itemType, "category"),
          ilike(parentSolution.name, `%${solutionName}%`)
        )
      )
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      price: null,
      contractTerm: null,
      itemType: "category",
      parentItem: null,
      targetAudience: null,
      features: [],
    }));
  }

  // Helper: get products under a solution+category
  public async getProductsForCategory(
    solutionName: string,
    categoryName: string,
    limit = 5
  ): Promise<EnrichedItem[]> {
    return this.searchByEntities(
      {
        solution: solutionName,
        category: categoryName,
        product_category: categoryName,
      },
      [],
      { limit }
    );
  }

  public async solutionHasProducts(solutionName: string): Promise<boolean> {
    const rows = await this.executeEntitySearch({ solution: solutionName }, []);
    return rows.some((r) => r.itemType === "product");
  }

  // New: name-based lookup to support template/inference product hints
  async searchByNames(
    names: string[],
    excludedIds: number[] = [],
    limit = 10
  ): Promise<EnrichedItem[]> {
    if (!names || names.length === 0) return [];

    const parentItem = alias(item, "parentItem");

    const baseQuery = db
      .select({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        contractTerm: item.contractTerm,
        itemType: item.itemType,
        parentItemId: item.parentItemId,
        parentItem: {
          id: parentItem.id,
          name: parentItem.name,
          description: parentItem.description,
        },
        targetAudience: {
          id: targetAudience.id,
          name: targetAudience.name,
          description: targetAudience.description,
        },
      })
      .from(item)
      .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
      .leftJoin(parentItem, eq(item.parentItemId, parentItem.id))
      .$dynamic();

    const nameConds = names
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .map((n) => ilike(item.name, `%${n}%`));

    const conditions: SQL[] = [];
    conditions.push(eq(item.isActive, true) as unknown as SQL);
    if (nameConds.length === 1) {
      conditions.push(nameConds[0] as unknown as SQL);
    } else if (nameConds.length > 1) {
      const nameOr = or(...(nameConds as unknown as SQL[]));
      if (nameOr) conditions.push(nameOr as unknown as SQL);
    }
    if (excludedIds.length > 0) {
      const notIn = notInArray(item.id, excludedIds) as unknown as SQL;
      conditions.push(notIn);
    }

    let rows;
    if (conditions.length > 1) {
      rows = await baseQuery.where(and(...conditions)).limit(limit);
    } else if (conditions.length === 1) {
      rows = await baseQuery.where(conditions[0]).limit(limit);
    } else {
      rows = await baseQuery.limit(limit);
    }
    return rows.map((r) => this.mapRowToEnriched(r));
  }

  // New: re-rank with template/inference hints
  rankWithHints(
    items: EnrichedItem[],
    entities: ExtractedEntitiesDto,
    hints?: { productNames?: string[]; categoryKeywords?: string[] }
  ): EnrichedItem[] {
    const scored = this.scoreAndRank(items, entities).map((s) => ({ ...s }));
    const productNames = (hints?.productNames || []).map((n) =>
      n.toLowerCase()
    );
    const catKeywords = (hints?.categoryKeywords || []).map((n) =>
      n.toLowerCase()
    );

    for (const s of scored) {
      const name = s.item.name.toLowerCase();
      if (productNames.some((n) => name.includes(n))) s.score += 25;
      if (
        catKeywords.some(
          (k) =>
            name.includes(k) || s.item.description?.toLowerCase().includes(k)
        )
      ) {
        s.score += 12;
      }
    }

    return scored.sort((a, b) => b.score - a.score).map((s) => s.item);
  }

  async searchByEntities(
    entities: ExtractedEntitiesDto,
    excludedIds: number[] = [],
    options?: {
      limit?: number;
      useFTS?: boolean;
      allowSpeculative?: boolean;
      strictToSolution?: boolean;
    }
  ): Promise<EnrichedItem[]> {
    const startTime = Date.now();

    try {
      // 🔥 NEW: If inference service predicted specific products, search for those first
      if (
        entities.predicted_products &&
        entities.predicted_products.length > 0
      ) {
        this.logger.info("Using predicted products from inference service", {
          predictedProducts: entities.predicted_products,
        });

        const predictedItems = await this.searchByProductNames(
          entities.predicted_products,
          excludedIds
        );

        if (predictedItems.length > 0) {
          this.logger.info("Found predicted products", {
            count: predictedItems.length,
            items: predictedItems.map((p) => p.name),
          });
          return predictedItems.slice(0, options?.limit ?? 5);
        }

        // 🔥 NEW: Product-priority fallback - search by solution for products only
        this.logger.warn(
          "Predicted products not found by name, trying solution-based product search"
        );

        if (entities.solution) {
          const solutionResults = await this.executeEntitySearch(
            { ...entities, solution: entities.solution },
            excludedIds
          );

          // Filter to PRODUCTS ONLY (not categories or solutions)
          const actualProducts = solutionResults.filter(
            (result) => result.itemType === "product"
          );

          if (actualProducts.length > 0) {
            this.logger.info("Found products via solution-based fallback", {
              count: actualProducts.length,
              items: actualProducts.map((p) => p.name),
              solution: entities.solution,
            });
            return actualProducts.slice(0, options?.limit ?? 5);
          }
        }

        // Last resort: fall through to regular search
        this.logger.info(
          "No products found in fallbacks, using regular search"
        );
      }

      // Prefer FTS when a clear search term exists
      const useFTS = options?.useFTS !== false;
      const hasSearchTerm = Boolean(
        (
          entities.solution ||
          entities.category ||
          entities.product_category
        )?.trim()
      );

      const items =
        useFTS && hasSearchTerm
          ? await this.executeFullTextSearch(entities, excludedIds)
          : await this.executeEntitySearch(entities, excludedIds);

      const scoredItems = this.scoreAndRank(items, entities);
      const limit = options?.limit ?? 5;
      const results = scoredItems.slice(0, limit).map((s) => s.item);

      // 🆕 Guard: if strictToSolution, do not cross-solution speculate
      if (
        results.length === 0 &&
        options?.strictToSolution &&
        entities.solution
      ) {
        this.logger.info("Strict solution mode: no cross-solution fallback", {
          solution: entities.solution,
        });
        return [];
      }

      // 🆕 If results are empty and speculative is allowed, get best guesses
      if (results.length === 0 && options?.allowSpeculative !== false) {
        this.logger.info("No results, trying speculative recommendations");
        const speculative = await this.getSpeculativeRecommendations(entities);
        return speculative.slice(0, limit);
      }

      this.logger.info("Search completed", {
        durationMs: Date.now() - startTime,
        resultCount: results.length,
        method: useFTS && hasSearchTerm ? "FTS" : "ILIKE",
      });

      return results;
    } catch (error: unknown) {
      this.logger.error("Item search failed", error as Error, {
        entities,
        excludedCount: excludedIds.length,
      });
      return [];
    }
  }

  /**
   * 🔥 ENHANCED: Search for items by product names with fuzzy matching
   * Extracts keywords to handle slight variations in database names
   */
  private async searchByProductNames(
    productNames: string[],
    excludedIds: number[]
  ): Promise<EnrichedItem[]> {
    const parentItem = alias(item, "parentItem");

    // 🔥 ENHANCED: Extract keywords and create multiple matching conditions
    const nameConditions = productNames.flatMap((name) => {
      const cleanName = name.trim();
      // Extract keywords (words longer than 3 chars) for flexible matching
      // e.g., "Starlink Enterprise Kit" → ["starlink", "enterprise"]
      const keywords = cleanName
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 3);

      return [
        eq(item.name, cleanName), // Exact match
        ilike(item.name, cleanName), // Case-insensitive exact
        ilike(item.name, `%${cleanName}%`), // Contains full name
        // Match individual important keywords
        ...keywords.map((keyword) => ilike(item.name, `%${keyword}%`)),
      ];
    });

    const conditions: SQL[] = [eq(item.isActive, true)];

    // Add name matching condition (OR of all variations)
    const nameCondition = or(...(nameConditions as unknown as SQL[]));
    if (nameCondition) {
      conditions.push(nameCondition);
    }

    if (excludedIds.length > 0) {
      conditions.push(notInArray(item.id, excludedIds));
    }

    const results = await db
      .select({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        contractTerm: item.contractTerm,
        itemType: item.itemType,
        parentItemId: item.parentItemId,
        parentItem: {
          id: parentItem.id,
          name: parentItem.name,
          description: parentItem.description,
        },
        targetAudience: {
          id: targetAudience.id,
          name: targetAudience.name,
          description: targetAudience.description,
        },
      })
      .from(item)
      .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
      .leftJoin(parentItem, eq(item.parentItemId, parentItem.id))
      .where(and(...conditions));

    // Prioritize products, then categories, then solutions
    return results
      .sort((a, b) => {
        const typeOrder = { product: 3, category: 2, solution: 1 };
        return (
          (typeOrder[b.itemType as keyof typeof typeOrder] || 0) -
          (typeOrder[a.itemType as keyof typeof typeOrder] || 0)
        );
      })
      .map((r) => this.mapRowToEnriched(r));
  }

  private async executeEntitySearch(
    entities: ExtractedEntitiesDto,
    excludedIds: number[]
  ): Promise<EnrichedItem[]> {
    const parentItem = alias(item, "parentItem");
    const solutionItem = alias(item, "solutionItem");

    const baseQuery = db
      .select({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        contractTerm: item.contractTerm,
        itemType: item.itemType,
        parentItemId: item.parentItemId,
        parentItem: {
          id: parentItem.id,
          name: parentItem.name,
          description: parentItem.description,
        },
        targetAudience: {
          id: targetAudience.id,
          name: targetAudience.name,
          description: targetAudience.description,
        },
      })
      .from(item)
      .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
      .leftJoin(parentItem, eq(item.parentItemId, parentItem.id))
      // Grandparent (solution) level for hierarchy filtering
      .leftJoin(solutionItem, eq(parentItem.parentItemId, solutionItem.id))
      .$dynamic();

    const conditions: SQL[] = [eq(item.isActive, true)];

    const searchTerm =
      entities.category || entities.product_category || entities.solution;
    if (searchTerm) {
      const keywords = searchTerm
        .toLowerCase()
        .split(/[\s,]+/)
        .filter((word) => word.length > 2);

      if (keywords.length > 0) {
        const keywordConditions = keywords.map((keyword) =>
          or(
            ilike(item.name, `%${keyword}%`),
            ilike(item.description, `%${keyword}%`)
          )
        );
        const searchCondition = or(...(keywordConditions as unknown as SQL[]));
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
    }

    if (entities.target_audience) {
      conditions.push(
        ilike(targetAudience.name, `%${entities.target_audience}%`)
      );
    }

    // Hierarchy filtering: category and solution by name
    // Fix: Also search for the item itself, not just items under it
    if (entities.category) {
      // Find: 1) The category itself, OR 2) Items under that category
      const categoryCondition = or(
        and(
          eq(item.itemType, "category"),
          ilike(item.name, `%${entities.category}%`)
        ),
        ilike(parentItem.name, `%${entities.category}%`)
      );
      if (categoryCondition) {
        conditions.push(categoryCondition);
      }
    }
    if (entities.solution) {
      // Find: 1) The solution itself, OR 2) Categories under it, OR 3) Products under those categories
      const solutionCondition = or(
        and(
          eq(item.itemType, "solution"),
          ilike(item.name, `%${entities.solution}%`)
        ),
        ilike(parentItem.name, `%${entities.solution}%`),
        ilike(solutionItem.name, `%${entities.solution}%`)
      );
      if (solutionCondition) {
        conditions.push(solutionCondition);
      }
    }

    // Strong anchoring for Security (avoid wrong solution bleed-over)
    if (
      entities.solution &&
      entities.solution.toLowerCase() === "security anti-ddos".toLowerCase()
    ) {
      // If a category is specified (On-Premise Defense / Hybrid Defenses / Cloud Defenses), prefer items under that category
      if (entities.category) {
        const secCat = or(
          and(
            eq(item.itemType, "category"),
            ilike(item.name, `%${entities.category}%`)
          ),
          ilike(parentItem.name, `%${entities.category}%`)
        ) as unknown as SQL;
        conditions.push(secCat);
      }
    }

    if (excludedIds.length > 0) {
      conditions.push(notInArray(item.id, excludedIds));
    }

    let results;
    if (conditions.length > 1) {
      results = await baseQuery.where(and(...conditions));
    } else if (conditions.length === 1) {
      results = await baseQuery.where(conditions[0]);
    } else {
      results = await baseQuery.limit(20);
    }

    return results.map((r) => this.mapRowToEnriched(r));
  }

  private async executeFullTextSearch(
    entities: ExtractedEntitiesDto,
    excludedIds: number[]
  ): Promise<EnrichedItem[]> {
    const baseTerms: string[] = [];
    if (entities.solution) baseTerms.push(entities.solution);
    if (entities.category) baseTerms.push(entities.category);
    if (entities.product_category) baseTerms.push(entities.product_category);

    // Expand with primary_use/features keywords to improve recall
    const expanders: string[] = [];
    if (entities.primary_use && entities.primary_use.length > 0) {
      expanders.push(...entities.primary_use);
    }
    if (entities.features && entities.features.length > 0) {
      expanders.push(...entities.features);
    }

    const tsInput = [...baseTerms, ...expanders].join(" ").trim();

    const parentItem = alias(item, "parentItem");
    const solutionItem = alias(item, "solutionItem");

    // Compute search vector on-the-fly to avoid schema changes dependency
    // Prefer indexed column search_vector when available
    const indexedVector: SQL = sql`${item.searchVector}` as SQL;
    const tsQueryExpr: SQL = sql`plainto_tsquery('english', ${tsInput})` as SQL;

    const baseQuery = db
      .select({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        contractTerm: item.contractTerm,
        itemType: item.itemType,
        parentItemId: item.parentItemId,
        rank: sql<number>`ts_rank(${indexedVector}, ${tsQueryExpr})`,
        parentItem: {
          id: parentItem.id,
          name: parentItem.name,
          description: parentItem.description,
        },
        targetAudience: {
          id: targetAudience.id,
          name: targetAudience.name,
          description: targetAudience.description,
        },
      })
      .from(item)
      .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
      .leftJoin(parentItem, eq(item.parentItemId, parentItem.id))
      .leftJoin(solutionItem, eq(parentItem.parentItemId, solutionItem.id))
      .$dynamic();

    const conditions: SQL[] = [
      eq(item.isActive, true),
      sql`${indexedVector} @@ ${tsQueryExpr}`,
    ];

    if (entities.target_audience) {
      conditions.push(
        ilike(targetAudience.name, `%${entities.target_audience}%`)
      );
    }

    // Hierarchy filtering: category and solution by name (when provided)
    // Fix: Also search for the item itself, not just items under it
    if (entities.category) {
      // Find: 1) The category itself, OR 2) Items under that category
      const categoryCondition = or(
        and(
          eq(item.itemType, "category"),
          ilike(item.name, `%${entities.category}%`)
        ),
        ilike(parentItem.name, `%${entities.category}%`)
      );
      if (categoryCondition) {
        conditions.push(categoryCondition);
      }
    }
    if (entities.solution) {
      // Find: 1) The solution itself, OR 2) Categories under it, OR 3) Products under those categories
      const solutionCondition = or(
        and(
          eq(item.itemType, "solution"),
          ilike(item.name, `%${entities.solution}%`)
        ),
        ilike(parentItem.name, `%${entities.solution}%`),
        ilike(solutionItem.name, `%${entities.solution}%`)
      );
      if (solutionCondition) {
        conditions.push(solutionCondition);
      }
    }

    if (excludedIds.length > 0) {
      conditions.push(notInArray(item.id, excludedIds));
    }

    const results = await baseQuery
      .where(and(...conditions))
      .orderBy(sql`ts_rank(${indexedVector}, ${tsQueryExpr}) DESC`)
      .limit(20);

    return results.map((r) => this.mapRowToEnriched(r));
  }

  private scoreAndRank(
    items: EnrichedItem[],
    entities: ExtractedEntitiesDto
  ): ScoredItem[] {
    const scoredItems = items.map((it) => {
      const breakdown = this.calculateScoreBreakdown(it, entities);
      const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
      return { item: it, score: total, scoreBreakdown: breakdown };
    });
    return scoredItems.sort((a, b) => b.score - a.score);
  }

  private calculateScoreBreakdown(
    it: EnrichedItem,
    entities: ExtractedEntitiesDto
  ): ScoredItem["scoreBreakdown"] {
    let exactMatch = 0;
    let textMatch = 0;
    let audienceMatch = 0;
    let itemTypeRelevance = 0;
    let keywordRelevance = 0;
    let intentRelevance = 0; // primary_use & features

    const searchTerm = (
      entities.category ||
      entities.product_category ||
      entities.solution ||
      ""
    ).toLowerCase();

    if (searchTerm && it.name.toLowerCase() === searchTerm) exactMatch = 50;
    if (searchTerm && it.name.toLowerCase().includes(searchTerm))
      textMatch = 30;
    if (searchTerm && it.description?.toLowerCase().includes(searchTerm))
      textMatch += 10;

    if (
      entities.target_audience &&
      it.targetAudience?.name
        .toLowerCase()
        .includes(entities.target_audience.toLowerCase())
    ) {
      audienceMatch = 30;
    }

    // 🔥 NEW: Check if this item matches predicted products (highest priority)
    if (entities.predicted_products && entities.predicted_products.length > 0) {
      const isPredicted = entities.predicted_products.some(
        (predicted) =>
          it.name.toLowerCase().includes(predicted.toLowerCase()) ||
          predicted.toLowerCase().includes(it.name.toLowerCase())
      );
      if (isPredicted) {
        // Massive boost for predicted products
        exactMatch += 100;
        this.logger.debug("Item matches predicted product", {
          itemName: it.name,
        });
      }
    }

    const hasSpecificNeeds = Boolean(
      (entities.features && entities.features.length > 0) ||
        (entities.primary_use && entities.primary_use.length > 0) ||
        (entities.num_users && entities.num_users > 0) ||
        (entities.predicted_products && entities.predicted_products.length > 0) // 🔥 NEW
    );
    const hasIndustryContext = Boolean(entities.target_audience);
    const hasInferredNeeds = Boolean(
      entities.inferred_needs && entities.inferred_needs.length > 0
    );

    // 🔥 ENHANCED: Better item type prioritization logic
    if (hasSpecificNeeds || hasInferredNeeds) {
      // User has specific needs OR inference detected needs - prioritize products heavily
      if (it.itemType === "product")
        itemTypeRelevance = 40; // Increased from 30
      else if (it.itemType === "category") itemTypeRelevance = 20;
      else if (it.itemType === "solution") itemTypeRelevance = 5; // Reduced from 10
    } else if (hasIndustryContext && !hasSpecificNeeds) {
      // When needs are vague but audience is known, prioritize categories to guide narrowing
      if (it.itemType === "category") itemTypeRelevance = 30;
      else if (it.itemType === "solution") itemTypeRelevance = 20;
      else if (it.itemType === "product") itemTypeRelevance = 25; // Increased to show some products
    } else {
      // Very vague: still show products if available, but solutions help structure
      if (it.itemType === "product")
        itemTypeRelevance = 25; // Increased from 10
      else if (it.itemType === "category")
        itemTypeRelevance = 30; // Increased from 20
      else if (it.itemType === "solution") itemTypeRelevance = 20; // Reduced from 30
    }

    const searchTerms = [
      entities.solution,
      entities.category,
      entities.product_category,
    ].filter(Boolean) as string[];
    for (const term of searchTerms) {
      if (it.name.toLowerCase().includes(term.toLowerCase()))
        keywordRelevance += 15;
      if (it.description?.toLowerCase().includes(term.toLowerCase()))
        keywordRelevance += 5;
    }

    // Solution anchoring and cross-solution penalty
    const requestedSolution = entities.solution?.toLowerCase();
    if (requestedSolution) {
      const lineage: string[] = [];
      if (it.parentItem?.name) lineage.push(it.parentItem.name.toLowerCase());
      lineage.push(it.name.toLowerCase());
      const anchored = lineage.some((n) => n.includes(requestedSolution));
      if (anchored) {
        keywordRelevance += 50; // strong boost
      } else {
        keywordRelevance -= 40; // strong penalty to avoid cross-solution bleed
      }
    }

    // Intent alignment: primary use cases and features keywords
    if (entities.primary_use && entities.primary_use.length > 0) {
      for (const use of entities.primary_use) {
        const u = use.toLowerCase();
        if (
          it.name.toLowerCase().includes(u) ||
          it.description?.toLowerCase().includes(u)
        ) {
          intentRelevance += 8;
        }
      }
    }
    if (entities.features && entities.features.length > 0) {
      for (const feat of entities.features) {
        const f = feat.toLowerCase();
        if (
          it.name.toLowerCase().includes(f) ||
          it.description?.toLowerCase().includes(f)
        ) {
          intentRelevance += 5;
        }
      }
    }

    return {
      textMatch,
      exactMatch,
      audienceMatch,
      itemTypeRelevance,
      keywordRelevance: keywordRelevance + intentRelevance,
    };
  }

  /**
   * Compute a set-level confidence 0..1 for the current recommendations.
   * Aggregates the top 3 item scores and adds small coverage bonuses.
   */
  public computeRecommendationConfidence(
    items: EnrichedItem[],
    entities: ExtractedEntitiesDto
  ): number {
    if (!items || items.length === 0) return 0;
    const scored = this.scoreAndRank(items, entities).slice(0, 3);
    const rawScores = scored.map((s) => s.score);
    // Normalize each score with a soft cap to 0..1
    const norm = rawScores.map((s) => s / (s + 100));
    const base = norm.reduce((a, b) => a + b, 0) / norm.length;

    // Coverage bonuses
    let bonus = 0;
    if (entities.solution) {
      const has = scored.some((s) =>
        (s.item.parentItem?.name || s.item.name)
          .toLowerCase()
          .includes(entities.solution!.toLowerCase())
      );
      if (has) bonus += 0.1;
    }
    if (entities.primary_use && entities.primary_use.length > 0) bonus += 0.1;
    if (entities.target_audience) bonus += 0.1;

    const confidence = Math.max(0, Math.min(1, base + bonus));
    return confidence;
  }

  /**
   * Get speculative recommendations when we have limited information
   * Returns "best guesses" based on what we know
   *
   * 🔥 FIXED: Prevents cross-solution contamination when a solution has no products
   */
  private async getSpeculativeRecommendations(
    entities: ExtractedEntitiesDto
  ): Promise<EnrichedItem[]> {
    const results: EnrichedItem[] = [];

    try {
      // Industry-based speculation - Hospitality
      if (entities.target_audience === "Hospitality") {
        const hospitalityItems = await this.searchByEntities(
          {
            solution: "Internet",
            category: "Fiber Broadband",
          },
          [],
          { limit: 2, allowSpeculative: false } // Prevent infinite loop
        );
        results.push(...hospitalityItems);
      }

      // Generic business - show best-sellers
      if (!entities.target_audience && entities.solution === "Internet") {
        const generic = await this.searchByEntities(
          {
            solution: "Internet",
            category: "Fiber Broadband",
          },
          [],
          { limit: 3, allowSpeculative: false }
        );
        results.push(...generic);
      }

      // 🔥 FIX: If we have a solution but no products, search for categories/solution itself
      // This prevents cross-solution contamination (e.g., showing Fiber when asking for Security)
      if (entities.solution && results.length === 0) {
        this.logger.info(
          "🔍 FIX: No products found, searching for categories under solution",
          {
            solution: entities.solution,
          }
        );

        const solutionItems = await this.executeEntitySearch(
          { solution: entities.solution },
          []
        );

        // Log what we found
        this.logger.info("🔍 FIX: Found items under requested solution", {
          solution: entities.solution,
          itemCount: solutionItems.length,
          itemTypes: solutionItems.map((i) => ({
            name: i.name,
            type: i.itemType,
          })),
        });

        if (solutionItems.length > 0) {
          // Prioritize categories over solutions to help guide the user
          const prioritized = [
            ...solutionItems.filter((i) => i.itemType === "category"),
            ...solutionItems.filter((i) => i.itemType === "solution"),
            ...solutionItems.filter((i) => i.itemType === "product"),
          ];
          results.push(...prioritized.slice(0, 5));

          // ✅ If we found categories/solution items, DON'T fall back to Internet
          this.logger.info(
            "🔍 FIX: Returning solution-specific items, skipping Internet fallback",
            {
              returnedCount: results.length,
            }
          );
          return results;
        }
      }

      // 🔥 FIX: Only fall back to Internet if NO solution was specified
      // This prevents showing Fiber products when asking for Security/other solutions
      if (results.length === 0 && !entities.solution) {
        this.logger.info(
          "🔍 FIX: No solution specified, defaulting to Internet"
        );
        const popular = await this.executeEntitySearch(
          { solution: "Internet" },
          []
        );
        results.push(...popular.slice(0, 3));
      } else if (results.length === 0 && entities.solution) {
        // If user asked for a specific solution but nothing found, return empty
        // This will trigger category discovery mode upstream
        this.logger.warn(
          "🔍 FIX: Solution specified but no items found - returning empty",
          {
            solution: entities.solution,
          }
        );
      }

      this.logger.info("Speculative recommendations generated", {
        count: results.length,
        audience: entities.target_audience,
        solution: entities.solution,
      });

      return results;
    } catch (error) {
      this.logger.error("Speculative recommendations failed", error as Error);
      return [];
    }
  }

  /**
   * NEW: Provide "close alternatives" when the user says current options don't help
   * Strategy:
   * - Relax strict filters (drop audience/features) but keep solution context when available
   * - Prefer PRODUCTS under the same solution; fall back to broader related items
   * - Fill remaining slots with speculative recommendations
   */
  public async getAlternativeRecommendations(
    entities: ExtractedEntitiesDto,
    alreadyShownIds: number[] = [],
    limit = 3
  ): Promise<EnrichedItem[]> {
    try {
      const excluded = [...alreadyShownIds];
      const relaxed: ExtractedEntitiesDto = { ...entities };
      // Relax filters: audience and fine-grained needs can narrow too much
      delete relaxed.target_audience;
      delete relaxed.features;
      delete relaxed.primary_use;

      const candidates: EnrichedItem[] = [];

      // 1) If we know the solution, fetch products under the same solution
      if (entities.solution) {
        const withinSolution = await this.executeEntitySearch(
          relaxed,
          excluded
        );
        candidates.push(
          ...withinSolution.filter((r) => r.itemType === "product")
        );
      }

      // 2) If insufficient, broaden further by dropping category hint
      if (candidates.length < limit) {
        const broader: ExtractedEntitiesDto = { ...relaxed };
        delete broader.category;
        delete broader.product_category;
        const more = await this.executeEntitySearch(broader, excluded);
        candidates.push(...more.filter((r) => r.itemType === "product"));
      }

      // 3) If still short, use speculative best-guesses
      if (candidates.length < limit) {
        const speculative = await this.getSpeculativeRecommendations(relaxed);
        candidates.push(...speculative);
      }

      // De-dupe and exclude already shown
      const dedup = new Map<number, EnrichedItem>();
      for (const c of candidates) {
        if (!excluded.includes(c.id) && !dedup.has(c.id)) dedup.set(c.id, c);
      }

      // Re-rank using current entities to keep relevance
      const ranked = this.scoreAndRank(Array.from(dedup.values()), entities)
        .map((s) => s.item)
        .slice(0, limit);

      this.logger.info("Alternative recommendations generated", {
        requested: limit,
        returned: ranked.length,
        solution: entities.solution,
      });

      return ranked;
    } catch (error) {
      this.logger.error("Alternative recommendations failed", error as Error);
      return [];
    }
  }

  private mapRowToEnriched(r: {
    id: number;
    name: string;
    description: string | null;
    price: string | null;
    contractTerm: string | null;
    itemType: string;
    parentItem?: {
      id: number;
      name: string;
      description: string | null;
    } | null;
    targetAudience?: {
      id: number;
      name: string;
      description: string | null;
    } | null;
  }): EnrichedItem {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      price: r.price,
      contractTerm: r.contractTerm,
      itemType: r.itemType as "solution" | "category" | "product",
      parentItem: r.parentItem ?? null,
      targetAudience: r.targetAudience ?? null,
      features: [],
    };
  }

  /**
   * NEW: Specialized search for VPN/Site-to-site needs
   * Prioritizes IP VPN and SD-WAN products under Transport
   */
  public async searchVpnProducts(
    entities: ExtractedEntitiesDto,
    excludedIds: number[] = [],
    limit = 5
  ): Promise<EnrichedItem[]> {
    try {
      const categories = ["IP VPN", "SD-WAN"];
      const results: EnrichedItem[] = [];
      for (const cat of categories) {
        const vpnEntities: ExtractedEntitiesDto = {
          ...entities,
          solution: "Transport",
          category: cat,
          product_category: cat,
        };
        const rows = await this.executeEntitySearch(vpnEntities, excludedIds);
        results.push(...rows.filter((r) => r.itemType === "product"));
      }

      if (results.length === 0) {
        // Fall back to broader Transport search if nothing found
        const broad = await this.executeEntitySearch(
          { ...entities, solution: "Transport" },
          excludedIds
        );
        results.push(...broad.filter((r) => r.itemType === "product"));
      }

      const ranked = this.scoreAndRank(results, entities)
        .map((s) => s.item)
        .slice(0, limit);
      return ranked;
    } catch (error) {
      this.logger.error("VPN search failed", error as Error);
      return [];
    }
  }
}
