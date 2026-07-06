import { Router } from "express";
import { emailController } from "../controllers/email.controller.js";
import { emailRateLimiter } from "../middleware/rate-limit.middleware.js";

const router = Router();

/**
 * @swagger
 * /email:
 *   post:
 *     summary: Send a templated email
 *     description: Marketing & sales-lead form submissions. Rate-limited to 5 requests per IP per 15 min.
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [contact, download, newsletter, pricing, inquiry, sales-lead]
 *               name: { type: string }
 *               email: { type: string }
 *               company: { type: string }
 *               address: { type: string }
 *               mobile: { type: string }
 *               inquiry: { type: string }
 *               downloadUrl: { type: string }
 *     responses:
 *       200: { description: Email sent }
 *       400: { description: Invalid body }
 *       429: { description: Rate limit exceeded }
 *       500: { description: Send failure }
 */
router.post("/", emailRateLimiter, emailController.send);

export default router;
