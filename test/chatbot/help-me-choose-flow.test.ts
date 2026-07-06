// test/chatbot/help-me-choose-flow.test.ts

/**
 * End-to-end (service level) test for the "Help me choose" clarification flow.
 *
 * When the user clicks the "Help me choose" button:
 *   1. Intent classifier returns `clarification_request` via fast path.
 *   2. ChatService emits a clarifying-questions message, NOT a product dump.
 *   3. No Socket.IO `recommendations` event with products is emitted.
 *   4. The response covers at least two of: use case/industry, size/users, priority.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatRequestDto } from "../../src/dtos/chat.dto.js";

// Mock intent classifier to return `clarification_request`
vi.mock("../../src/services/gemini-intent-classifier.service.js", () => ({
	GeminiIntentClassifierService: vi.fn().mockImplementation(() => ({
		classifyIntent: vi.fn().mockResolvedValue({
			intent: "clarification_request",
			confidence: 0.95,
			normalizedMessage: "Help me choose",
			extractedContext: {},
			reasoning: "Fast path: 'help me choose'",
		}),
	})),
}));

// Mock topic-switch detector (unused in this path but imported by ChatService)
vi.mock("../../src/services/topic-switch-detector.service.js", () => ({
	TopicSwitchDetectorService: vi.fn().mockImplementation(() => ({
		detectTopicSwitch: vi.fn().mockResolvedValue({ isTopicSwitch: false }),
	})),
}));

// Mock session service
vi.mock("../../src/services/session-management.service.js", () => ({
	SessionManagementService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock LangChain (should not be invoked for clarification_request)
const mockLangChain = {
	extractEntities: vi.fn(),
	generateResponse: vi.fn(),
	generateResponseStream: vi.fn(),
	generateStructuredResponse: vi.fn(),
	generateRecommendationsFromCatalog: vi.fn(),
};
vi.mock("../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => mockLangChain),
}));

// Mock context service — return empty context + spy on saveTurn
const mockSaveTurn = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/services/context.service.js", () => ({
	ContextService: vi.fn().mockImplementation(() => ({
		loadIntelligentContext: vi.fn().mockResolvedValue({
			recentTurns: [],
			userPreferences: {},
			currentRecommendations: [],
			conversationStage: "discovery",
		}),
		saveTurn: mockSaveTurn,
		getConversationCount: vi.fn().mockResolvedValue(0),
		mergeWithContext: vi.fn((current) => current),
	})),
}));

// Mock DB (minimal)
vi.mock("../../src/db/index.js", () => {
	const q = () => ({
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		$dynamic: vi.fn().mockReturnThis(),
		values: vi.fn().mockReturnThis(),
		onConflictDoUpdate: vi.fn().mockReturnThis(),
		returning: vi.fn().mockReturnThis(),
		execute: vi.fn(),
		then: vi.fn((r: (v: unknown[]) => unknown) => r([])),
		set: vi.fn().mockReturnThis(),
	});
	return {
		db: {
			insert: vi.fn(() => q()),
			select: vi.fn(() => q()),
			update: vi.fn(() => q()),
			transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
				cb({ insert: vi.fn(() => q()), select: vi.fn(() => q()), update: vi.fn(() => q()) })
			),
		},
	};
});

// Import AFTER mocks
const { ChatService } = await import("../../src/services/chat.service.js");

function createMockSocket() {
	const events: Array<{ event: string; payload: unknown }> = [];
	const socket = {
		id: "test-socket-id",
		emit: vi.fn((event: string, payload: unknown) => {
			events.push({ event, payload });
		}),
	};
	return { socket, events };
}

describe("Help me choose clarification flow", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("emits a clarifying-questions response and NO product recommendations", async () => {
		const chatService = new ChatService();
		const { socket, events } = createMockSocket();

		const request: ChatRequestDto = {
			session_id: "e7c9e5e8-3a51-4c27-9f28-0e1f6d4b1a02",
			message: "Help me choose",
		} as ChatRequestDto;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await chatService.processMessageStream(request, socket as any);

		// Must have emitted a start, at least one token, and end
		expect(events.find((e) => e.event === "start")).toBeDefined();
		expect(events.find((e) => e.event === "end")).toBeDefined();

		// Response text must mention at least two of: use case/industry, size/users, priority
		const responseText = events
			.filter((e) => e.event === "token")
			.map((e) => (e.payload as { payload?: string }).payload ?? "")
			.join("");

		const lower = responseText.toLowerCase();
		const topics = [
			/(office|hotel|retail|industry|use case)/,
			/(users?|employees?|team|size|people)/,
			/(priority|speed|security|support|budget|most important|goal)/,
		];
		const hits = topics.filter((re) => re.test(lower)).length;
		expect(hits).toBeGreaterThanOrEqual(2);

		// No product names (we don't reach the recommender)
		expect(mockLangChain.generateRecommendationsFromCatalog).not.toHaveBeenCalled();

		// If a recommendations event was emitted, its payload must be empty
		const recEvt = events.find((e) => e.event === "recommendations");
		if (recEvt) {
			expect(recEvt.payload).toEqual({ payload: [] });
		}
	});

	it("persists the clarification turn via contextService.saveTurn", async () => {
		const chatService = new ChatService();
		const { socket } = createMockSocket();

		await chatService.processMessageStream(
			{
				session_id: "e7c9e5e8-3a51-4c27-9f28-0e1f6d4b1a02",
				message: "Help me choose",
			} as ChatRequestDto,
			socket as unknown as Parameters<
				typeof chatService.processMessageStream
			>[1],
		);

		expect(mockSaveTurn).toHaveBeenCalled();
		const [, , response] = mockSaveTurn.mock.calls[0];
		expect((response as { reply: string }).reply.length).toBeGreaterThan(0);
	});
});
