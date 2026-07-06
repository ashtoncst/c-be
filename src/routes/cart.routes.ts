import { Router } from "express";
import cartController from "../controllers/cart.controller.js";

const router = Router();

/**
 * @swagger
 * /cart/session:
 *   post:
 *     summary: Generate new session ID
 *     description: Create a new session ID for ephemeral users to start shopping
 *     tags: [Cart]
 *     responses:
 *       201:
 *         description: New session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SessionInfo'
 */
router.post("/session", cartController.generateSession);

/**
 * @swagger
 * /cart/session/{sessionId}:
 *   get:
 *     summary: Get session information
 *     description: Retrieve information about a specific session
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Session information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SessionInfo'
 */
router.get("/session/:sessionId", cartController.getSessionInfo);

/**
 * @swagger
 * /cart/add:
 *   post:
 *     summary: Add product to cart
 *     description: Add a product to the ephemeral user's cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddToCart'
 *     responses:
 *       201:
 *         description: Product added to cart
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CartItem'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data or product already in cart
 *       404:
 *         description: Product not found
 */
router.post("/add", cartController.addToCart);

/**
 * @swagger
 * /cart/remove:
 *   delete:
 *     summary: Remove product from cart
 *     description: Remove a specific product from the cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RemoveFromCart'
 *     responses:
 *       200:
 *         description: Product removed from cart
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Product not found in cart
 */
router.delete("/remove", cartController.removeFromCart);

/**
 * @swagger
 * /cart/{sessionId}:
 *   get:
 *     summary: Get cart contents
 *     description: Retrieve all items in the cart for a specific session
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Cart contents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CartResponse'
 */
router.get("/:sessionId", cartController.getCartContents);

/**
 * @swagger
 * /cart/{sessionId}/count:
 *   get:
 *     summary: Get cart item count
 *     description: Get the number of items in the cart
 *     tags: [Cart]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Cart item count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                     count:
 *                       type: integer
 */
router.get("/:sessionId/count", cartController.getCartItemCount);

/**
 * @swagger
 * /cart/clear:
 *   delete:
 *     summary: Clear entire cart
 *     description: Remove all items from the cart
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ClearCart'
 *     responses:
 *       200:
 *         description: Cart cleared successfully
 *       400:
 *         description: Invalid request data
 */
router.delete("/clear", cartController.clearCart);

/**
 * @swagger
 * /cart/convert:
 *   post:
 *     summary: Convert cart to sales lead
 *     description: Convert ephemeral cart to a sales lead with customer information
 *     tags: [Cart]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSalesLead'
 *     responses:
 *       201:
 *         description: Cart converted to sales lead
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SalesLeadResponse'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid request data or empty cart
 */
router.post("/convert", cartController.convertToSalesLead);

export default router;
