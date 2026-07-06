// src/websockets/chat.handler.ts
import { Server, Socket } from "socket.io";
import { ChatService } from "../services/chat.service.js";
import { ChatRequestDto } from "../dtos/chat.dto.js";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { randomUUID } from "crypto";
import { RateLimiter } from "../utils/rate-limiter.js";
import { extractClientIp } from "../utils/ip-extractor.js";

const MAX_TURNS_PER_SESSION = 100;

export function initializeWebSocketHandler(io: Server) {
	const chatService = new ChatService();

	// --- Rate limiters (sliding window) ---
	const sessionLimiter = new RateLimiter(10, 60_000); // 10 msg/min per session
	const ipLimiter = new RateLimiter(30, 60_000); // 30 msg/min per IP

	// --- Concurrent request guard: one in-flight request per session ---
	const inFlightSessions = new Set<string>();

	io.on("connection", (socket: Socket) => {
		const clientInfo = {
			socketId: socket.id,
			transport: socket.conn.transport.name,
			userAgent: socket.handshake.headers["user-agent"],
			origin: socket.handshake.headers.origin,
			referer: socket.handshake.headers.referer,
			secure: socket.handshake.secure,
			timestamp: new Date().toISOString(),
		};
		console.log(`✅ Client connected:`, clientInfo);

		socket.on("chat_message", async (messageData: unknown) => {
			const messageDataPreview = messageData as { session_id?: string | null; message?: string };
			console.log("Received chat_message:", {
				session_id: messageDataPreview?.session_id ?? null,
				message_length: typeof messageDataPreview?.message === "string" ? messageDataPreview.message.length : 0,
			});
			try {
				// 1. Auto-generate session_id if missing or null
				const messageDataWithSession = messageData as {
					session_id?: string | null;
					message?: string;
				};

				if (
					!messageDataWithSession.session_id ||
					messageDataWithSession.session_id === "null" ||
					messageDataWithSession.session_id.trim() === ""
				) {
					const newSessionId = randomUUID();
					console.log(
						`🔄 Auto-generating session ID for chat (socketId: ${socket.id}, newSessionId: ${newSessionId})`
					);
					messageDataWithSession.session_id = newSessionId;
				}

				// 2. Validate DTO (includes MaxLength(2000) on message)
				const chatRequest = plainToInstance(
					ChatRequestDto,
					messageDataWithSession
				);
				const validationErrors = await validate(chatRequest);

				if (validationErrors.length > 0) {
					const messages = validationErrors
						.map((e) => Object.values(e.constraints ?? {}))
						.flat();
					socket.emit("error", {
						type: "validation_error",
						code: "VALIDATION_ERROR",
						payload: `Invalid input: ${messages.join(", ")}`,
					});
					return;
				}

				// 3. IP rate limit check
				const clientIp = extractClientIp(socket);

				if (!ipLimiter.isAllowed(clientIp)) {
					socket.emit("error", {
						type: "rate_limited",
						code: "RATE_LIMITED",
						retryAfterMs: ipLimiter.retryAfterMs(clientIp),
						payload:
							"Too many messages. Please wait a moment before sending another.",
					});
					return;
				}

				// 4. Session rate limit check
				const sessionId = chatRequest.session_id;

				if (!sessionLimiter.isAllowed(sessionId)) {
					socket.emit("error", {
						type: "rate_limited",
						code: "RATE_LIMITED",
						retryAfterMs: sessionLimiter.retryAfterMs(sessionId),
						payload:
							"You're sending messages too quickly. Please slow down.",
					});
					return;
				}

				// 5. Concurrent request guard
				if (inFlightSessions.has(sessionId)) {
					socket.emit("error", {
						type: "concurrent_request",
						code: "CONCURRENT_REQUEST",
						retryAfterMs: 0,
						payload:
							"Please wait for the current response to complete.",
					});
					return;
				}

				// 6. Turn cap check
				const turnCount =
					await chatService.getConversationCount(sessionId);
				if (turnCount >= MAX_TURNS_PER_SESSION) {
					socket.emit("error", {
						type: "turn_limit",
						code: "TURN_LIMIT_REACHED",
						payload:
							"This conversation has reached its limit. Please start a new session.",
					});
					return;
				}

				// 7. Process chat stream (with concurrent guard)
				inFlightSessions.add(sessionId);
				try {
					await chatService.processMessageStream(
						chatRequest,
						socket
					);
				} finally {
					inFlightSessions.delete(sessionId);
				}
			} catch (error) {
				console.error(`[${socket.id}] Chat handler failed:`, error);

				if (
					error instanceof Error &&
					error.message.includes("database")
				) {
					socket.emit("error", {
						type: "database_error",
						code: "DATABASE_ERROR",
						payload:
							"I'm having trouble accessing our product database. Please try again in a moment.",
					});
				} else if (
					error instanceof Error &&
					error.message.includes("ai")
				) {
					socket.emit("error", {
						type: "ai_error",
						code: "AI_ERROR",
						payload:
							"I'm having trouble processing your request. Let me try a different approach.",
					});
				} else {
					socket.emit("error", {
						type: "general_error",
						code: "GENERAL_ERROR",
						payload:
							"Something went wrong. Please try rephrasing your question.",
					});
				}

				socket.emit("end");
			}
		});

		socket.on("disconnect", (reason) => {
			console.log(`Client disconnected: ${socket.id}. Reason: ${reason}`);
		});
	});
}
