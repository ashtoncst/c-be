import { Request, Response } from "express";
import { ItemService } from "../services/item.service.js";
import { ItemQueryDto } from "../dtos/item.dto.js";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "ItemController" });
const itemService = new ItemService();

export class ItemController {
  /**
   * GET /api/items
   * Get all items with optional filtering
   */
  async getItems(req: Request, res: Response): Promise<void> {
    try {
      const queryDto = plainToInstance(ItemQueryDto, {
        itemType: req.query.item_type,
        parentItemId: req.query.parent_item_id
          ? parseInt(req.query.parent_item_id as string)
          : undefined,
        targetAudienceId: req.query.target_audience_id
          ? parseInt(req.query.target_audience_id as string)
          : undefined,
        isActive: req.query.is_active === "false" ? false : true,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      });

      const errors = await validate(queryDto);
      if (errors.length > 0) {
        res.status(400).json({ errors });
        return;
      }

      const result = await itemService.getItems(queryDto);
      res.json(result);
    } catch (error) {
      logger.error("Error in getItems", error as Error);
      res.status(500).json({
        error: "Failed to fetch items",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/:id
   * Get a single item by ID
   */
  async getItemById(req: Request, res: Response): Promise<void> {
    try {
      const id = parseInt(req.params.id);

      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid item ID" });
        return;
      }

      const result = await itemService.getItemById(id);

      if (!result) {
        res.status(404).json({ error: "Item not found" });
        return;
      }

      res.json(result);
    } catch (error) {
      logger.error(`Error in getItemById: ${req.params.id}`, error as Error);
      res.status(500).json({
        error: "Failed to fetch item",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/solutions
   * Get all solutions (top-level items)
   */
  async getSolutions(req: Request, res: Response): Promise<void> {
    try {
      const solutions = await itemService.getSolutions();
      res.json(solutions);
    } catch (error) {
      logger.error("Error in getSolutions", error as Error);
      res.status(500).json({
        error: "Failed to fetch solutions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/categories
   * Get all categories, optionally filtered by solution
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const solutionId = req.query.solution_id
        ? parseInt(req.query.solution_id as string)
        : undefined;

      const categories = await itemService.getCategories(solutionId);
      res.json(categories);
    } catch (error) {
      logger.error("Error in getCategories", error as Error);
      res.status(500).json({
        error: "Failed to fetch categories",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/products
   * Get all products, optionally filtered by category
   */
  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const categoryId = req.query.category_id
        ? parseInt(req.query.category_id as string)
        : undefined;

      const products = await itemService.getProducts(categoryId);
      res.json(products);
    } catch (error) {
      logger.error("Error in getProducts", error as Error);
      res.status(500).json({
        error: "Failed to fetch products",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/hierarchy
   * Get complete item hierarchy: solutions → categories → products
   */
  async getHierarchy(req: Request, res: Response): Promise<void> {
    try {
      const solutionId = req.query.solution_id
        ? parseInt(req.query.solution_id as string)
        : undefined;

      const hierarchy = await itemService.getItemHierarchy(solutionId);
      res.json(hierarchy);
    } catch (error) {
      logger.error("Error in getHierarchy", error as Error);
      res.status(500).json({
        error: "Failed to fetch item hierarchy",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * GET /api/items/target-audiences
   * Get all target audiences
   */
  async getTargetAudiences(req: Request, res: Response): Promise<void> {
    try {
      const audiences = await itemService.getTargetAudiences();
      res.json(audiences);
    } catch (error) {
      logger.error("Error in getTargetAudiences", error as Error);
      res.status(500).json({
        error: "Failed to fetch target audiences",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
