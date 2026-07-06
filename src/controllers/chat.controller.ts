// src/controllers/chat.controller.ts
import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ChatRequestDto } from "../dtos/chat.dto.js";
import { ChatService } from "../services/chat.service.js";
import {
	signSessionCookie,
	SESSION_COOKIE_NAME,
} from "../utils/session-cookie.util.js";

export class ChatController {
	private chatService: ChatService;

	constructor() {
		this.chatService = new ChatService();
	}

	/**
	 * Creates a new chat session. If SESSION_COOKIE_SECRET is set, binds the
	 * session to the browser via an httpOnly signed cookie (session-scoped).
	 * When the flag is off, the session_id alone is returned (back-compat).
	 */
	createSession = async (req: Request, res: Response): Promise<void> => {
		try {
			const sessionId = randomUUID();
			const secret = process.env.SESSION_COOKIE_SECRET;

			if (secret) {
				const signed = signSessionCookie(sessionId, secret);
				const attrs = [
					`${SESSION_COOKIE_NAME}=${signed}`,
					"Path=/",
					"HttpOnly",
					"SameSite=Lax",
				];
				if (process.env.NODE_ENV === "production") attrs.push("Secure");
				res.setHeader("Set-Cookie", attrs.join("; "));
			}

			res.status(200).json({ session_id: sessionId });
		} catch (error) {
			console.error("Create session error:", error);
			res.status(500).json({
				success: false,
				message: "Internal server error",
			});
		}
	};

	handleChat = async (req: Request, res: Response): Promise<void> => {
		try {
			// Transform and validate request
			const chatRequest = plainToInstance(ChatRequestDto, req.body);
			const validationErrors = await validate(chatRequest);

			if (validationErrors.length > 0) {
				res.status(400).json({
					message: "Invalid request data",
					errors: validationErrors.map((err) => ({
						property: err.property,
						constraints: err.constraints,
					})),
				});
				return;
			}

			// Process chat request using new catalog-in-prompt approach
			const response = await this.chatService.processMessage(chatRequest);

			res.status(200).json(response);
		} catch (error) {
			console.error("Chat controller error:", error);
			res.status(500).json({
				message: "Internal server error",
				session_id: req.body?.session_id || "unknown",
			});
		}
	};

	getChatHistory = async (req: Request, res: Response): Promise<void> => {
		try {
			const { session_id } = req.params;

			// sessionAuth middleware has already validated that session_id is
			// present, non-null, a real UUID, and (when the flag is on) that
			// the browser's cookie matches.
			const history = await this.chatService.getChatHistory(session_id);

			res.status(200).json({
				success: true,
				data: {
					session_id,
					conversations: history,
					total_messages: history.length,
				},
			});
		} catch (error) {
			console.error("Get chat history error:", error);
			res.status(500).json({
				success: false,
				message: "Internal server error",
			});
		}
	};

	/**
	 * Wipes all conversation turns for the given session_id so a "fresh" chat
	 * doesn't leak prior topic context into the next exchange (UAT FAIL fix).
	 * Idempotent: returns 200 even when there's nothing to delete.
	 * sessionAuth has already validated UUID format and (when SESSION_COOKIE_SECRET
	 * is set) that the browser's signed cookie matches.
	 */
	resetSession = async (req: Request, res: Response): Promise<void> => {
		try {
			const { session_id } = req.params;
			const result = await this.chatService.resetSession(session_id);

			res.status(200).json({
				success: true,
				data: {
					session_id,
					deleted_rows: result.deletedRows,
				},
			});
		} catch (error) {
			console.error("Reset session error:", error);
			res.status(500).json({
				success: false,
				message: "Internal server error",
			});
		}
	};
}
