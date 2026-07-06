// test/unit/context-formatter.test.ts

/**
 * Test suite for ContextFormatter clarification/refinement stage formatting.
 *
 * Bug: when user asks "Tell me more about that" after receiving a
 * recommendation, the clarification-stage formatter summarizes entities only,
 * but omits the previously recommended product names — so the downstream
 * LLM has no anchor for "that" and pivots to unrelated products.
 *
 * Fix: formatForClarification must surface previously recommended product
 * names so the LLM can ground its follow-up answer.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ContextFormatter } from "../../src/services/context-formatter.service.js";
import type {
	ConversationContext,
	ConversationTurn,
	EnrichedItem,
	ExtractedEntitiesDto,
} from "../../src/dtos/chat.dto.js";

const makeItem = (id: number, name: string): EnrichedItem =>
	({
		id,
		name,
		description: null,
		price: null,
		contractTerm: null,
		itemType: "product",
		parentItem: null,
		targetAudience: null,
		features: [],
	} as unknown as EnrichedItem);

const makeTurn = (
	userMessage: string,
	botResponse: string,
	entities: Partial<ExtractedEntitiesDto> = {}
): ConversationTurn => ({
	userMessage,
	botResponse,
	extractedEntities: entities as ExtractedEntitiesDto,
	timestamp: new Date(),
});

describe("ContextFormatter — clarification carries previous recommendations", () => {
	let formatter: ContextFormatter;

	beforeEach(() => {
		formatter = new ContextFormatter();
	});

	it("emits previously recommended product names when the stage is refinement", () => {
		const context: ConversationContext = {
			recentTurns: [
				makeTurn(
					"Recommend a cloud solution for a small business",
					"Here are 2 options worth looking at: Cloud Compute Essentials, Cloud Storage Basic.",
					{ solution: "Cloud" }
				),
			],
			userPreferences: {},
			currentRecommendations: [
				makeItem(101, "Cloud Compute Essentials"),
				makeItem(102, "Cloud Storage Basic"),
			],
			conversationStage: "refinement",
		};

		const result = formatter.formatContextForState(context, "Tell me more about that");

		expect(result.length).toBeGreaterThan(0);
		const concatenated = result.map((m) => m.content).join(" ");
		expect(concatenated).toContain("Cloud Compute Essentials");
		expect(concatenated).toContain("Cloud Storage Basic");
		// And still surfaces the solution tag so the LLM stays on-topic
		expect(concatenated.toLowerCase()).toContain("cloud");
	});

	it("still returns entity summary when there are no previous recommendations", () => {
		const context: ConversationContext = {
			recentTurns: [
				makeTurn("we are a 50-person hotel", "Great, noted — what else?", {
					target_audience: "hotel",
					num_users: 50,
				}),
			],
			userPreferences: {},
			currentRecommendations: [],
			conversationStage: "refinement",
		};

		const result = formatter.formatContextForState(
			context,
			"prioritize speed"
		);

		expect(result.length).toBeGreaterThan(0);
		const concatenated = result.map((m) => m.content).join(" ");
		expect(concatenated.toLowerCase()).toContain("hotel");
		expect(concatenated).toContain("50");
	});

	it("emits an empty array when there is no prior context at all", () => {
		const context: ConversationContext = {
			recentTurns: [],
			userPreferences: {},
			currentRecommendations: [],
			conversationStage: "refinement",
		};

		expect(formatter.formatContextForState(context, "tell me more")).toEqual(
			[]
		);
	});

	it("surfaces recommendations even when the previous turn's entities are thin", () => {
		// Simulates the real-world case where recommendedProducts was saved but
		// extractedEntities was partial (e.g. earlier bug in classifier).
		const context: ConversationContext = {
			recentTurns: [
				makeTurn(
					"cloud",
					"Here are 2 options: Cloud Compute Essentials, Cloud Storage Basic.",
					{}
				),
			],
			userPreferences: {},
			currentRecommendations: [
				makeItem(101, "Cloud Compute Essentials"),
				makeItem(102, "Cloud Storage Basic"),
			],
			conversationStage: "refinement",
		};

		const result = formatter.formatContextForState(
			context,
			"what speeds does it support?"
		);

		expect(result.length).toBeGreaterThan(0);
		const concatenated = result.map((m) => m.content).join(" ");
		expect(concatenated).toContain("Cloud Compute Essentials");
	});
});
