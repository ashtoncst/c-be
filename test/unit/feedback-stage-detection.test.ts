// test/unit/feedback-stage-detection.test.ts

/**
 * Feedback-stage detection hardening.
 *
 * Production defect (D2): when Gemini fails and the deterministic fallback
 * in langchain.service.ts emits a templated recommendation ("Here are N
 * options worth looking at...") or committal recommendation ("I'd recommend
 * X. Want to see alternatives or compare options?"), the feedback stage
 * never activates. A subsequent "yes" therefore never triggers the
 * deterministic sales@converge.com / converge.com/quote closing reply.
 *
 * Root cause: determineConversationStage only recognizes the literal
 * phrase "does that answer your question" as a feedback prompt. Fallback
 * replies use different phrasings.
 *
 * Fix: treat any bot reply that (a) had recommendations AND (b) ends with
 * a question OR contains a known confirmation-prompt phrase as feedback.
 */

import { describe, it, expect } from "vitest";
import { ContextSelector } from "../../src/services/context-selector.service.js";
import type { ConversationTurn, EnrichedItem } from "../../src/dtos/chat.dto.js";

const makeTurn = (userMessage: string, botResponse: string): ConversationTurn => ({
	userMessage,
	botResponse,
	extractedEntities: {} as ConversationTurn["extractedEntities"],
	timestamp: new Date(),
});

const makeRec = (id: number, name: string): EnrichedItem => ({
	id,
	name,
	description: `Description for ${name}`,
	price: "1000",
	contractTerm: "12 months",
	itemType: "product",
	parentItem: null,
	targetAudience: null,
	features: [],
});

type Determiner = (
	turns: ConversationTurn[],
	recommendations: EnrichedItem[]
) => string;

function getDetermineStage(svc: ContextSelector): Determiner {
	// Access the private method directly for focused stage-detection tests.
	return (svc as unknown as { determineConversationStage: Determiner })
		.determineConversationStage.bind(svc);
}

describe("ContextSelector.determineConversationStage — feedback recognition", () => {
	const svc = new ContextSelector();
	const determine = getDetermineStage(svc);

	it('recognizes the canonical "does that answer your question" prompt', () => {
		const turns = [
			makeTurn(
				"I need internet",
				"I'd recommend Fiber Broadband PEAK. Does that answer your question?"
			),
		];
		const recs = [makeRec(1, "Fiber Broadband PEAK")];
		expect(determine(turns, recs)).toBe("feedback");
	});

	it('recognizes the fallback "Want to see alternatives or compare options?" prompt', () => {
		// Fallback "committal" reply shape from langchain.service.ts:492.
		const turns = [
			makeTurn(
				"I need internet",
				"I'd recommend **Fiber Broadband PEAK 50-100 mbps**. Want to see alternatives or compare options?"
			),
		];
		const recs = [makeRec(1, "Fiber Broadband PEAK 50-100 mbps")];
		expect(determine(turns, recs)).toBe("feedback");
	});

	it('recognizes the fallback "metro or remote, how many users" discovery prompt as feedback when products are shown', () => {
		// Fallback "discovery" reply shape from langchain.service.ts:494.
		const turns = [
			makeTurn(
				"internet",
				"Here are 5 options worth looking at: Fiber Broadband PEAK 50-100 mbps, Fiber Broadband PEAK 100-200 mbps. Which direction fits best — metro or remote, and roughly how many users?"
			),
		];
		const recs = [
			makeRec(1, "Fiber Broadband PEAK 50-100 mbps"),
			makeRec(2, "Fiber Broadband PEAK 100-200 mbps"),
		];
		expect(determine(turns, recs)).toBe("feedback");
	});

	it("treats any trailing question with recommendations as feedback", () => {
		// Generic shape — any Gemini or fallback reply that ends with "?" AND
		// shipped recommendations should let "yes" close the loop.
		const turns = [
			makeTurn(
				"security",
				"I recommend our Cloud Defenses package. Would you like a quote?"
			),
		];
		const recs = [makeRec(1, "Cloud Defenses")];
		expect(determine(turns, recs)).toBe("feedback");
	});

	it("stays in 'recommendation' when the bot made a statement with no follow-up question", () => {
		const turns = [
			makeTurn(
				"internet",
				"Here is your custom plan for the office: Fiber Broadband PEAK 50-100 mbps."
			),
		];
		const recs = [makeRec(1, "Fiber Broadband PEAK 50-100 mbps")];
		expect(determine(turns, recs)).toBe("recommendation");
	});
});
