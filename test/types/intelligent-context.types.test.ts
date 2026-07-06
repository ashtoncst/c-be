import { describe, it, expect } from "vitest";
import type {
	RelevanceScore,
	RelevanceScoreCategories,
	QueryType,
	SelectionStrategy,
	IntelligentContextOptions,
	SummarizationLevel,
	ConversationFacts,
} from "../../src/types/intelligent-context.types.js";

describe("Intelligent Context Type Definitions", () => {
	describe("RelevanceScore Types", () => {
		it("should define RelevanceScore with correct structure", () => {
			const score: RelevanceScore = {
				turnIndex: 0,
				score: 8.5,
				reason: "Directly related to current query",
				categories: {
					directReference: true,
					topicContinuation: true,
					contextualDependency: false,
					informationValue: 9,
				},
			};

			expect(score.turnIndex).toBe(0);
			expect(score.score).toBeGreaterThanOrEqual(0);
			expect(score.score).toBeLessThanOrEqual(10);
			expect(typeof score.reason).toBe("string");
			expect(score.categories).toBeDefined();
		});

		it("should define RelevanceScoreCategories with boolean and number types", () => {
			const categories: RelevanceScoreCategories = {
				directReference: false,
				topicContinuation: true,
				contextualDependency: true,
				informationValue: 7,
			};

			expect(typeof categories.directReference).toBe("boolean");
			expect(typeof categories.topicContinuation).toBe("boolean");
			expect(typeof categories.contextualDependency).toBe("boolean");
			expect(typeof categories.informationValue).toBe("number");
			expect(categories.informationValue).toBeGreaterThanOrEqual(0);
			expect(categories.informationValue).toBeLessThanOrEqual(10);
		});

		it("should allow scores from 0 to 10", () => {
			const minScore: RelevanceScore = {
				turnIndex: 0,
				score: 0,
				reason: "Not relevant",
				categories: {
					directReference: false,
					topicContinuation: false,
					contextualDependency: false,
					informationValue: 0,
				},
			};

			const maxScore: RelevanceScore = {
				turnIndex: 1,
				score: 10,
				reason: "Highly relevant",
				categories: {
					directReference: true,
					topicContinuation: true,
					contextualDependency: true,
					informationValue: 10,
				},
			};

			expect(minScore.score).toBe(0);
			expect(maxScore.score).toBe(10);
		});
	});

	describe("QueryType Enum", () => {
		it("should define all query types", () => {
			const types: QueryType[] = [
				"product_search",
				"comparison",
				"follow_up",
				"new_topic",
				"clarification",
			];

			types.forEach((type) => {
				expect(typeof type).toBe("string");
			});
		});

		it("should allow assignment to QueryType", () => {
			const type1: QueryType = "product_search";
			const type2: QueryType = "comparison";
			const type3: QueryType = "follow_up";
			const type4: QueryType = "new_topic";
			const type5: QueryType = "clarification";

			expect([type1, type2, type3, type4, type5]).toHaveLength(5);
		});
	});

	describe("SelectionStrategy Type", () => {
		it("should define complete selection strategy structure", () => {
			const strategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2,
					currentRecommendations: true,
				},
				relevanceThreshold: 6.0,
				maxTurns: 5,
				tokenBudget: 6000,
			};

			expect(strategy.alwaysInclude.recentCount).toBeGreaterThan(0);
			expect(typeof strategy.alwaysInclude.currentRecommendations).toBe(
				"boolean"
			);
			expect(strategy.relevanceThreshold).toBeGreaterThanOrEqual(0);
			expect(strategy.relevanceThreshold).toBeLessThanOrEqual(10);
			expect(strategy.maxTurns).toBeGreaterThan(0);
			expect(strategy.tokenBudget).toBeGreaterThan(0);
		});

		it("should allow different strategy configurations", () => {
			const followUpStrategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 2,
					currentRecommendations: true,
				},
				relevanceThreshold: 8.0,
				maxTurns: 3,
				tokenBudget: 8000,
			};

			const newTopicStrategy: SelectionStrategy = {
				alwaysInclude: {
					recentCount: 1,
					currentRecommendations: false,
				},
				relevanceThreshold: 4.0,
				maxTurns: 5,
				tokenBudget: 5000,
			};

			expect(followUpStrategy.relevanceThreshold).toBeGreaterThan(
				newTopicStrategy.relevanceThreshold
			);
			expect(followUpStrategy.maxTurns).toBeLessThan(newTopicStrategy.maxTurns);
		});
	});

	describe("IntelligentContextOptions Type", () => {
		it("should define options with all required fields", () => {
			const options: IntelligentContextOptions = {
				query: "What are installation requirements?",
				allTurns: [],
				userPreferences: {},
				currentRecommendations: [],
			};

			expect(typeof options.query).toBe("string");
			expect(Array.isArray(options.allTurns)).toBe(true);
			expect(typeof options.userPreferences).toBe("object");
			expect(Array.isArray(options.currentRecommendations)).toBe(true);
		});

		it("should allow complex nested structures", () => {
			const options: IntelligentContextOptions = {
				query: "Tell me more",
				allTurns: [
					{
						userMessage: "I need internet",
						botResponse: "Here are some options...",
						extractedEntities: {
							solution: "Internet",
						},
						timestamp: new Date(),
					},
				],
				userPreferences: {
					industry: "Hospitality",
					scale: 50,
				},
				currentRecommendations: [
					{
						id: 1,
						name: "Fiber Broadband",
						description: "High-speed internet",
						price: "1000",
						contractTerm: "12 months",
						itemType: "product",
						parentItem: {
							id: 10,
							name: "Internet",
							description: null,
							itemType: "category",
						},
						targetAudience: null,
						features: [],
					},
				],
			};

			expect(options.allTurns).toHaveLength(1);
			expect(options.allTurns[0].userMessage).toBe("I need internet");
		});
	});

	describe("SummarizationLevel Type", () => {
		it("should define all summarization levels", () => {
			const detailed: SummarizationLevel = "detailed";
			const condensed: SummarizationLevel = "condensed";
			const compressed: SummarizationLevel = "compressed";

			expect([detailed, condensed, compressed]).toHaveLength(3);
		});

		it("should only allow defined levels", () => {
			const level: SummarizationLevel = "detailed";
			expect(["detailed", "condensed", "compressed"]).toContain(level);
		});
	});

	describe("ConversationFacts Type", () => {
		it("should define conversation facts structure", () => {
			const facts: ConversationFacts = {
				industry: "Hospitality",
				businessSize: "50 rooms",
				budget: "mid-range",
				requirements: ["high-speed internet", "guest wifi"],
				decisions: {
					accepted: ["Fiber Broadband"],
					rejected: ["Satellite"],
				},
			};

			expect(facts.industry).toBe("Hospitality");
			expect(facts.businessSize).toBe("50 rooms");
			expect(facts.budget).toBe("mid-range");
			expect(facts.requirements).toHaveLength(2);
			expect(facts.decisions.accepted).toHaveLength(1);
			expect(facts.decisions.rejected).toHaveLength(1);
		});

		it("should allow optional fields", () => {
			const minimalFacts: ConversationFacts = {
				requirements: [],
				decisions: {
					accepted: [],
					rejected: [],
				},
			};

			expect(minimalFacts.industry).toBeUndefined();
			expect(minimalFacts.businessSize).toBeUndefined();
			expect(minimalFacts.budget).toBeUndefined();
			expect(minimalFacts.requirements).toEqual([]);
			expect(minimalFacts.decisions.accepted).toEqual([]);
		});

		it("should handle complex requirements and decisions", () => {
			const facts: ConversationFacts = {
				industry: "Healthcare",
				businessSize: "200 beds",
				budget: "enterprise",
				requirements: [
					"HIPAA compliance",
					"redundant connections",
					"24/7 support",
					"DDoS protection",
				],
				decisions: {
					accepted: [
						"Fiber Dedicated",
						"Security Anti-DDoS",
						"Managed Services",
					],
					rejected: ["Satellite", "Basic Fiber"],
				},
			};

			expect(facts.requirements.length).toBeGreaterThan(3);
			expect(facts.decisions.accepted.length).toBeGreaterThan(2);
		});
	});

	describe("Type Compatibility", () => {
		it("should allow RelevanceScore to be stored in arrays", () => {
			const scores: RelevanceScore[] = [
				{
					turnIndex: 0,
					score: 8,
					reason: "Relevant",
					categories: {
						directReference: true,
						topicContinuation: true,
						contextualDependency: false,
						informationValue: 8,
					},
				},
				{
					turnIndex: 1,
					score: 3,
					reason: "Not very relevant",
					categories: {
						directReference: false,
						topicContinuation: false,
						contextualDependency: false,
						informationValue: 2,
					},
				},
			];

			expect(scores).toHaveLength(2);
			expect(scores[0].score).toBeGreaterThan(scores[1].score);
		});

		it("should allow SelectionStrategy to be used in maps", () => {
			const strategies: Record<QueryType, SelectionStrategy> = {
				product_search: {
					alwaysInclude: { recentCount: 2, currentRecommendations: false },
					relevanceThreshold: 6.0,
					maxTurns: 5,
					tokenBudget: 6000,
				},
				comparison: {
					alwaysInclude: { recentCount: 1, currentRecommendations: true },
					relevanceThreshold: 7.0,
					maxTurns: 4,
					tokenBudget: 7000,
				},
				follow_up: {
					alwaysInclude: { recentCount: 2, currentRecommendations: true },
					relevanceThreshold: 8.0,
					maxTurns: 3,
					tokenBudget: 8000,
				},
				new_topic: {
					alwaysInclude: { recentCount: 1, currentRecommendations: false },
					relevanceThreshold: 4.0,
					maxTurns: 5,
					tokenBudget: 5000,
				},
				clarification: {
					alwaysInclude: { recentCount: 2, currentRecommendations: true },
					relevanceThreshold: 7.0,
					maxTurns: 4,
					tokenBudget: 7000,
				},
			};

			expect(Object.keys(strategies)).toHaveLength(5);
			expect(strategies.follow_up.relevanceThreshold).toBe(8.0);
		});
	});
});
