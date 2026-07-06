// src/services/item.service.ts

/**
 * ItemService: Provides CRUD-like operations for catalog items
 *
 * Handles database operations for:
 * - Solutions: Top-level service categories (Internet, Transport, Security, etc.)
 * - Categories: Product groupings within solutions
 * - Products: Individual products with features, pricing, and specifications
 *
 * Features:
 * - Fetch items with filtering by type, parent ID, search query
 * - Pagination support
 * - Retrieve item hierarchies (solutions → categories → products)
 * - Get single items by ID with full details (features, target audience, etc.)
 */

import { db } from "../db/index.js";

import { eq, and, ilike, desc, count, or } from "drizzle-orm";
import {
  item,
  targetAudience,
  itemFeature,
  feature,
} from "../models/schema.model.js";
import {
  ItemDto,
  ItemQueryDto,
  ItemListResponseDto,
} from "../dtos/item.dto.js";
import { plainToInstance } from "class-transformer";
import { SQL } from "drizzle-orm";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "ItemService" });

export class ItemService {
  /**
   * Get all items with optional filtering and pagination
   * Supports: solutions, categories, and products
   */
  async getItems(queryParams: ItemQueryDto): Promise<ItemListResponseDto> {
    try {
      const limit = queryParams.limit || 10;
      const offset = queryParams.offset || 0;

      const conditions: SQL[] = [];

      // Filter by item type
      if (queryParams.itemType) {
        conditions.push(eq(item.itemType, queryParams.itemType));
      }

      // Filter by parent item ID
      if (queryParams.parentItemId) {
        conditions.push(eq(item.parentItemId, queryParams.parentItemId));
      }

      // Filter by target audience
      if (queryParams.targetAudienceId) {
        conditions.push(
          eq(item.targetAudienceId, queryParams.targetAudienceId)
        );
      }

      // Filter by active status (default: only active)
      const isActiveValue =
        queryParams.isActive !== undefined ? queryParams.isActive : true;
      conditions.push(eq(item.isActive, isActiveValue));

      // Search by name or description
      if (queryParams.search) {
        const searchCondition = or(
          ilike(item.name, `%${queryParams.search}%`),
          ilike(item.description, `%${queryParams.search}%`)
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }

      // Get total count
      let totalResult;
      if (conditions.length > 0) {
        [totalResult] = await db
          .select({ count: count() })
          .from(item)
          .where(and(...conditions));
      } else {
        [totalResult] = await db.select({ count: count() }).from(item);
      }

      const total = totalResult?.count || 0;

      // Get items with related data
      const baseQuery = db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          parentItemId: item.parentItemId,
          price: item.price,
          contractTerm: item.contractTerm,
          targetAudience: targetAudience.name,
          isActive: item.isActive,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
        .from(item)
        .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id));

      // Apply where conditions (always has at least isActive condition)
      const results = await baseQuery
        .where(and(...conditions))
        .orderBy(desc(item.createdAt))
        .limit(limit)
        .offset(offset);

      // Transform to DTOs
      const itemDtos = results.map((result) =>
        plainToInstance(ItemDto, {
          id: result.id,
          name: result.name,
          description: result.description,
          itemType: result.itemType as "solution" | "category" | "product",
          parentItemId: result.parentItemId,
          price: result.price,
          contractTerm: result.contractTerm,
          targetAudience: result.targetAudience || undefined,
          isActive: result.isActive,
          createdAt:
            result.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt:
            result.updatedAt?.toISOString() || new Date().toISOString(),
        })
      );

      return plainToInstance(ItemListResponseDto, {
        items: itemDtos,
        total,
        limit,
        offset,
      });
    } catch (error) {
      logger.error("Error fetching items", error as Error);
      throw new Error("Failed to fetch items");
    }
  }

  /**
   * Get a single item by ID with all features
   */
  async getItemById(id: number): Promise<ItemDto | null> {
    try {
      const [result] = await db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          parentItemId: item.parentItemId,
          price: item.price,
          contractTerm: item.contractTerm,
          targetAudience: targetAudience.name,
          isActive: item.isActive,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
        .from(item)
        .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
        .where(eq(item.id, id));

      if (!result) {
        return null;
      }

      // Get features
      const features = await db
        .select({
          id: feature.id,
          name: feature.name,
          description: feature.description,
        })
        .from(itemFeature)
        .innerJoin(feature, eq(itemFeature.featureId, feature.id))
        .where(eq(itemFeature.itemId, id));

      return plainToInstance(ItemDto, {
        id: result.id,
        name: result.name,
        description: result.description,
        itemType: result.itemType,
        parentItemId: result.parentItemId,
        price: result.price,
        contractTerm: result.contractTerm,
        targetAudience: result.targetAudience || undefined,
        isActive: result.isActive,
        features: features.map((f) => f.name),
        createdAt: result.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: result.updatedAt?.toISOString() || new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error fetching item by ID: ${id}`, error as Error);
      throw new Error(`Failed to fetch item with ID ${id}`);
    }
  }

  /**
   * Get all solutions (top-level items)
   */
  async getSolutions(): Promise<ItemDto[]> {
    try {
      const results = await db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          createdAt: item.createdAt,
        })
        .from(item)
        .where(and(eq(item.itemType, "solution"), eq(item.isActive, true)))
        .orderBy(item.name);

      return results.map((r) =>
        plainToInstance(ItemDto, {
          id: r.id,
          name: r.name,
          description: r.description,
          itemType: r.itemType as "solution",
          parentItemId: null,
          isActive: true,
          createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
        })
      );
    } catch (error) {
      logger.error("Error fetching solutions", error as Error);
      throw new Error("Failed to fetch solutions");
    }
  }

  /**
   * Get all categories, optionally filtered by solution
   */
  async getCategories(solutionId?: number): Promise<ItemDto[]> {
    try {
      const conditions: SQL[] = [
        eq(item.itemType, "category"),
        eq(item.isActive, true),
      ];

      if (solutionId) {
        conditions.push(eq(item.parentItemId, solutionId));
      }

      const results = await db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          parentItemId: item.parentItemId,
          createdAt: item.createdAt,
        })
        .from(item)
        .where(and(...conditions))
        .orderBy(item.name);

      return results.map((r) =>
        plainToInstance(ItemDto, {
          id: r.id,
          name: r.name,
          description: r.description,
          itemType: r.itemType as "category",
          parentItemId: r.parentItemId || undefined,
          isActive: true,
          createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
        })
      );
    } catch (error) {
      logger.error(
        `Error fetching categories for solution: ${solutionId}`,
        error as Error
      );
      throw new Error("Failed to fetch categories");
    }
  }

  /**
   * Get all products, optionally filtered by category
   */
  async getProducts(categoryId?: number): Promise<ItemDto[]> {
    try {
      const conditions: SQL[] = [
        eq(item.itemType, "product"),
        eq(item.isActive, true),
      ];

      if (categoryId) {
        conditions.push(eq(item.parentItemId, categoryId));
      }

      const results = await db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
          parentItemId: item.parentItemId,
          price: item.price,
          contractTerm: item.contractTerm,
          targetAudience: targetAudience.name,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })
        .from(item)
        .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
        .where(and(...conditions))
        .orderBy(item.name);

      return results.map((r) =>
        plainToInstance(ItemDto, {
          id: r.id,
          name: r.name,
          description: r.description,
          itemType: r.itemType as "product",
          parentItemId: r.parentItemId || undefined,
          price: r.price,
          contractTerm: r.contractTerm,
          targetAudience: r.targetAudience || undefined,
          isActive: true,
          createdAt: r.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: r.updatedAt?.toISOString() || new Date().toISOString(),
        })
      );
    } catch (error) {
      logger.error(
        `Error fetching products for category: ${categoryId}`,
        error as Error
      );
      throw new Error("Failed to fetch products");
    }
  }

  /**
   * Get target audiences
   */
  async getTargetAudiences(): Promise<Array<{ id: number; name: string }>> {
    try {
      const results = await db
        .select({
          id: targetAudience.id,
          name: targetAudience.name,
        })
        .from(targetAudience)
        .orderBy(targetAudience.name);

      return results;
    } catch (error) {
      logger.error("Error fetching target audiences", error as Error);
      throw new Error("Failed to fetch target audiences");
    }
  }

  /**
   * Get item hierarchy: solution → categories → products
   */
  async getItemHierarchy(solutionId?: number): Promise<
    Array<{
      id: number;
      name: string;
      description: string | null;
      itemType: string;
      categories: Array<{
        id: number;
        name: string;
        description: string | null;
        itemType: string;
        productCount: number;
      }>;
    }>
  > {
    try {
      const solutionConditions: SQL[] = [
        eq(item.itemType, "solution"),
        eq(item.isActive, true),
      ];

      if (solutionId) {
        solutionConditions.push(eq(item.id, solutionId));
      }

      // Get solutions
      const solutions = await db
        .select({
          id: item.id,
          name: item.name,
          description: item.description,
          itemType: item.itemType,
        })
        .from(item)
        .where(and(...solutionConditions))
        .orderBy(item.name);

      // Build hierarchy
      const hierarchy = [];
      for (const solution of solutions) {
        // Get categories for this solution
        const categories = await db
          .select({
            id: item.id,
            name: item.name,
            description: item.description,
            itemType: item.itemType,
          })
          .from(item)
          .where(
            and(
              eq(item.itemType, "category"),
              eq(item.parentItemId, solution.id),
              eq(item.isActive, true)
            )
          )
          .orderBy(item.name);

        // Get product count for each category
        const categoriesWithCount = [];
        for (const category of categories) {
          const [productCount] = await db
            .select({ count: count() })
            .from(item)
            .where(
              and(
                eq(item.itemType, "product"),
                eq(item.parentItemId, category.id),
                eq(item.isActive, true)
              )
            );

          categoriesWithCount.push({
            ...category,
            productCount: productCount?.count || 0,
          });
        }

        hierarchy.push({
          ...solution,
          categories: categoriesWithCount,
        });
      }

      return hierarchy;
    } catch (error) {
      logger.error(
        `Error fetching item hierarchy for solution: ${solutionId}`,
        error as Error
      );
      throw new Error("Failed to fetch item hierarchy");
    }
  }
}
