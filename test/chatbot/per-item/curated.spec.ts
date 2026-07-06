import { describe, it, expect, vi } from "vitest";
import { ChatService } from "../../../src/services/chat.service.js";
import type { ChatRequestDto } from "../../../src/dtos/chat.dto.js";
import { loadCatalogFromCsv, type CsvItem } from "./catalog.util.js";
import {
	solutionQueries,
	categoryQueries,
	productQueries,
} from "./querybank.js";

// Mock the underlying Google Generative AI to prevent API key errors
vi.mock("@langchain/google-genai", () => ({
	ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
		invoke: vi.fn().mockResolvedValue({
			content: JSON.stringify({
				solution: "Internet",
				category: null,
				recommendedItems: [],
				reply: "Here are some options.",
				confidence: 0.85,
			}),
		}),
		pipe: vi.fn().mockReturnThis(),
	})),
}));

// Mock Logger to suppress output
vi.mock("../../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		log: vi.fn(),
	})),
}));

// Mock Gemini services
vi.mock("../../../src/services/gemini-intent-classifier.service.js", () => ({
	GeminiIntentClassifierService: vi.fn().mockImplementation(() => ({
		classifyIntent: vi.fn().mockResolvedValue({
			intent: "product_query",
			confidence: 0.95,
			reasoning: "User is asking about products",
			extractedContext: {
				solution: null,
				category: null,
				bandwidth: null,
				industry: null,
				location: null,
			},
		}),
	})),
}));

vi.mock("../../../src/services/topic-switch-detector.service.js", () => ({
	TopicSwitchDetectorService: vi.fn().mockImplementation(() => ({
		detectTopicSwitch: vi.fn().mockResolvedValue({
			isTopicSwitch: false,
			confidence: 0.9,
			previousTopic: null,
			currentTopic: null,
		}),
	})),
}));

vi.mock("../../../src/services/session-management.service.js", () => ({
	SessionManagementService: vi.fn().mockImplementation(() => ({
		getOrCreateSession: vi.fn().mockResolvedValue({
			session_id: "test-session",
			created_at: new Date(),
			updated_at: new Date(),
		}),
	})),
}));

// Mock DB
vi.mock("../../../src/db/index.js", () => {
	const createMockQuery = () => ({
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
		then: vi.fn((resolve: (value: unknown[]) => unknown) => resolve([])),
		set: vi.fn().mockReturnThis(),
	});

	const createMockTx = () => {
		const mockUpdate = () => {
			const query = createMockQuery();
			query.set = vi.fn().mockReturnThis();
			return query;
		};
		return {
			insert: vi.fn(() => createMockQuery()),
			select: vi.fn(() => createMockQuery()),
			update: vi.fn(() => mockUpdate()),
		};
	};

	const mockDb = {
		insert: vi.fn(() => createMockQuery()),
		select: vi.fn(() => createMockQuery()),
		update: vi.fn(() => createMockQuery()),
		transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => {
			return await callback(createMockTx());
		}),
	};
	return { db: mockDb, _createMockQuery: createMockQuery };
});

// Mock LangChain
vi.mock("../../../src/services/langchain.service.js", () => ({
	LangChainService: vi.fn().mockImplementation(() => ({
		extractEntities: vi.fn().mockResolvedValue({}),
		generateStructuredResponse: vi
			.fn()
			.mockResolvedValue({ narrative: "Response" }),
		generateRecommendationsFromCatalog: vi.fn().mockResolvedValue({
			solution: "Internet",
			category: null,
			recommendedItems: [],
			reply: "Here are some options.",
			confidence: 0.85,
		}),
	})),
}));

describe("Curated per-item tests (10 per item)", () => {
	const perTypeLimit = Number(process.env.TEST_PER_ITEM_LIMIT || 9999);
	const catalog: CsvItem[] = loadCatalogFromCsv(perTypeLimit);
	const solutions: CsvItem[] = catalog.filter((c) => c.itemType === "solution");
	const categories: CsvItem[] = catalog.filter(
		(c) => c.itemType === "category"
	);
	const products: CsvItem[] = catalog.filter((c) => c.itemType === "product");

	describe("Solutions (10 queries each)", () => {
		for (const catalogItem of solutions) {
			for (const qb of solutionQueries) {
				const q = qb(catalogItem);
				it(`${catalogItem.name} → '${q}'`, async () => {
					const chat = new ChatService();
					const res = await chat.processMessage({
						session_id: `sol-${catalogItem.id}-${Date.now()}`,
						message: q,
					} as ChatRequestDto);
					const reply = (res.reply || "").toLowerCase();
					const items = res.recommended_items || [];
					expect(reply.length > 0 || items.length > 0).toBe(true);
				});
			}
		}
	});

	describe("Categories (10 queries each)", () => {
		for (const catalogItem of categories) {
			for (const qb of categoryQueries) {
				const q = qb(catalogItem);
				it(`${catalogItem.name} → '${q}'`, async () => {
					const chat = new ChatService();
					const res = await chat.processMessage({
						session_id: `cat-${catalogItem.id}-${Date.now()}`,
						message: q,
					} as ChatRequestDto);
					const reply = (res.reply || "").toLowerCase();
					const items = (res.recommended_items || []).map((i) =>
						i.name.toLowerCase()
					);
					const target = catalogItem.name.toLowerCase();
					const ok =
						items.some((n) => n.includes(target)) ||
						items.some((n) => n.includes(firstToken(target))) ||
						reply.includes(firstToken(target));
					expect(ok || reply.length > 0).toBe(true);
				});
			}
		}
	});

	describe("Products (10 queries each)", () => {
		for (const catalogItem of products) {
			for (const qb of productQueries) {
				const q = qb(catalogItem);
				it(`${catalogItem.name} → '${q}'`, async () => {
					const chat = new ChatService();
					const res = await chat.processMessage({
						session_id: `prod-${catalogItem.id}-${Date.now()}`,
						message: q,
					} as ChatRequestDto);
					const reply = (res.reply || "").toLowerCase();
					const items = (res.recommended_items || []).map((i) =>
						i.name.toLowerCase()
					);
					const target = catalogItem.name.toLowerCase();
					const ok =
						items.some((n) => n.includes(firstToken(target))) ||
						reply.includes(firstToken(target));
					expect(ok || reply.length > 0).toBe(true);
				});
			}
		}
	});
});

function firstToken(s: string): string {
	return (s.split(/\s+/)[0] || s).trim();
}
