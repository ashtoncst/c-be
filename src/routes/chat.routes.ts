// src/routes/chat.routes.ts
import { Router } from "express";
import { ChatController } from "../controllers/chat.controller.js";
import { sessionAuth } from "../middleware/session-auth.middleware.js";

const router = Router();
const chatController = new ChatController();

/**
 * @swagger
 * /chat/session:
 *   post:
 *     summary: Create a new chat session
 *     description: |
 *       Creates a new session_id. If SESSION_COOKIE_SECRET is configured, also
 *       issues an httpOnly signed cookie binding the browser to this session —
 *       subsequent GET /chat/history/:id calls will require this cookie.
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: New session created
 */
router.post("/session", chatController.createSession);

/**
 * @swagger
 * /chat:
 *   post:
 *     summary: Chat with AI assistant (WebSocket Recommended)
 *     description: |
 *       This endpoint returns a 426 status because the chat functionality 
 *       now uses WebSockets for real-time communication.
 *       For the best experience, connect via WebSocket to the Socket.IO endpoint.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatRequest'
 *     responses:
 *       426:
 *         description: Upgrade Required - Use WebSocket connection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "This endpoint now uses WebSockets. Please connect via a WebSocket client."
 */
router.post("/", (req, res) => {
	res.status(426).json({
		message: "This endpoint now uses WebSockets. Please connect via a WebSocket client.",
	});
});

/**
 * @swagger
 * /chat/history/{session_id}:
 *   get:
 *     summary: Get chat history
 *     description: Retrieve conversation history for a specific session
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Session identifier
 *     responses:
 *       200:
 *         description: Chat history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 session_id:
 *                   type: string
 *       400:
 *         description: Session ID is required
 */
router.get(
	"/history/:session_id",
	sessionAuth,
	chatController.getChatHistory
);

/**
 * @swagger
 * /chat/reset/{session_id}:
 *   post:
 *     summary: Reset a chat session
 *     description: |
 *       Permanently deletes all conversation turns for the given session_id so
 *       prior context doesn't bleed into the next exchange. Idempotent:
 *       succeeds with deleted_rows=0 if there was nothing to delete. Honours
 *       the same SESSION_COOKIE_SECRET feature flag as GET /history.
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session reset
 *       400:
 *         description: Missing or invalid session id
 *       401:
 *         description: Cookie required (when feature flag is on)
 *       403:
 *         description: Cookie does not match the requested session
 */
router.post(
	"/reset/:session_id",
	sessionAuth,
	chatController.resetSession
);

export default router;
