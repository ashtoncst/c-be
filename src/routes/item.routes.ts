import { Router } from "express";
import { ItemController } from "../controllers/item.controller.js";

const router = Router();
const itemController = new ItemController();

/**
 * @swagger
 * /api/items:
 *   get:
 *     summary: Get all items (solutions, categories, products)
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: item_type
 *         schema:
 *           type: string
 *           enum: [solution, category, product]
 *         description: Filter by item type
 *       - in: query
 *         name: parent_item_id
 *         schema:
 *           type: integer
 *         description: Filter by parent item ID
 *       - in: query
 *         name: target_audience_id
 *         schema:
 *           type: integer
 *         description: Filter by target audience
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of items
 */
router.get("/", itemController.getItems.bind(itemController));

/**
 * @swagger
 * /api/items/solutions:
 *   get:
 *     summary: Get all solutions (top-level items)
 *     tags: [Items]
 *     responses:
 *       200:
 *         description: List of solutions
 */
router.get("/solutions", itemController.getSolutions.bind(itemController));

/**
 * @swagger
 * /api/items/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: solution_id
 *         schema:
 *           type: integer
 *         description: Filter by solution ID
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get("/categories", itemController.getCategories.bind(itemController));

/**
 * @swagger
 * /api/items/products:
 *   get:
 *     summary: Get all products
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filter by category ID
 *     responses:
 *       200:
 *         description: List of products
 */
router.get("/products", itemController.getProducts.bind(itemController));

/**
 * @swagger
 * /api/items/hierarchy:
 *   get:
 *     summary: Get complete item hierarchy (solutions → categories → products)
 *     tags: [Items]
 *     parameters:
 *       - in: query
 *         name: solution_id
 *         schema:
 *           type: integer
 *         description: Get hierarchy for specific solution
 *     responses:
 *       200:
 *         description: Hierarchical item structure
 */
router.get("/hierarchy", itemController.getHierarchy.bind(itemController));

/**
 * @swagger
 * /api/items/target-audiences:
 *   get:
 *     summary: Get all target audiences
 *     tags: [Items]
 *     responses:
 *       200:
 *         description: List of target audiences
 */
router.get(
  "/target-audiences",
  itemController.getTargetAudiences.bind(itemController)
);

/**
 * @swagger
 * /api/items/{id}:
 *   get:
 *     summary: Get a single item by ID
 *     tags: [Items]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Item details
 *       404:
 *         description: Item not found
 */
router.get("/:id", itemController.getItemById.bind(itemController));

export default router;
