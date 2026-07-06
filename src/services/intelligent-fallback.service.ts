// src/services/intelligent-fallback.service.ts

/**
 * IntelligentFallbackService: Provides smart fallback recommendations
 *
 * When specific product matches aren't found, this service generates recommendations based on:
 * - Business scenarios (small/medium/large organizations)
 * - Industry profiles (Hospitality, Banking, Retail, etc.)
 * - Message hints (keywords, business size indicators)
 *
 * Analyzes user message for context clues and matches them with predefined
 * business scenarios and industry templates to provide relevant fallback suggestions.
 */

import { EnrichedItem } from "../dtos/chat.dto.js";

export interface BusinessScenario {
	name: string;
	description: string;
	employeeRange: string;
	assumedBandwidth: string;
	recommendedCategories: string[];
	recommendedProducts: string[];
	reasoning: string;
}

export interface IndustryProfile {
	name: string;
	targetAudienceId: number;
	commonNeeds: string[];
	priorityCategories: string[];
	securityRequirements: "low" | "medium" | "high";
	redundancyNeeds: "low" | "medium" | "high";
}

export class IntelligentFallbackService {
	/**
	 * Business size-based scenarios for fallback recommendations
	 */
	private readonly businessScenarios: BusinessScenario[] = [
		{
			name: "Small Business / Startup",
			description: "Small teams with basic connectivity needs",
			employeeRange: "1-10 employees",
			assumedBandwidth: "50-100Mbps",
			recommendedCategories: ["Fiber Broadband", "Dedicated Internet Access"],
			recommendedProducts: [
				"Business Fiber Internet",
				"DIA Standard 50Mbps",
				"DIA Standard 100Mbps",
			],
			reasoning:
				"Small businesses typically need cost-effective, reliable internet for basic operations, email, and web browsing.",
		},
		{
			name: "Growing Business",
			description: "Medium-sized businesses with moderate to high usage",
			employeeRange: "10-50 employees",
			assumedBandwidth: "100-300Mbps",
			recommendedCategories: ["Dedicated Internet Access", "Managed Services"],
			recommendedProducts: [
				"DIA Standard 150Mbps",
				"DIA Standard 300Mbps",
				"Managed Wi-Fi Plus",
			],
			reasoning:
				"Growing businesses need reliable dedicated internet with consistent speeds and may benefit from managed services to reduce IT overhead.",
		},
		{
			name: "Established Business",
			description:
				"Larger businesses with high connectivity and reliability needs",
			employeeRange: "50-200 employees",
			assumedBandwidth: "300Mbps-1Gbps",
			recommendedCategories: [
				"Dedicated Internet Access",
				"Data",
				"Managed Services",
			],
			recommendedProducts: [
				"DIA Standard 500Mbps",
				"DIA Standard 1Gbps",
				"DIA Premium",
				"eLine",
			],
			reasoning:
				"Established businesses require high-speed, dedicated connections with redundancy options and enterprise-grade reliability.",
		},
		{
			name: "Enterprise / Large Corporation",
			description: "Large organizations with complex networking needs",
			employeeRange: "200+ employees",
			assumedBandwidth: "1Gbps+",
			recommendedCategories: [
				"Data",
				"Cable Systems",
				"Cloud, AI & Cybersecurity",
				"Managed Services",
			],
			recommendedProducts: [
				"Metro Lambda",
				"IP-VPN (Layer 3)",
				"Managed SD-WAN",
				"SecOps Studio",
				"BIFROST Cable System",
			],
			reasoning:
				"Large enterprises need enterprise-grade solutions with advanced security, redundancy, and managed services for complex network infrastructure.",
		},
	];

	/**
	 * Industry-specific profiles for targeted recommendations
	 */
	private readonly industryProfiles: IndustryProfile[] = [
		{
			name: "Hospitality",
			targetAudienceId: 101,
			commonNeeds: ["Guest Wi-Fi", "In-room entertainment", "POS systems"],
			priorityCategories: ["Fiber Broadband", "Managed Services"],
			securityRequirements: "medium",
			redundancyNeeds: "high",
		},
		{
			name: "Banking & Financial Services",
			targetAudienceId: 103,
			commonNeeds: ["Security", "Compliance", "High availability"],
			priorityCategories: [
				"Data",
				"Cloud, AI & Cybersecurity",
				"Dedicated Internet Access",
			],
			securityRequirements: "high",
			redundancyNeeds: "high",
		},
		{
			name: "Government & Retail",
			targetAudienceId: 102,
			commonNeeds: [
				"Public services",
				"Customer connectivity",
				"Point of sale",
			],
			priorityCategories: [
				"Fiber Broadband",
				"Dedicated Internet Access",
				"Managed Services",
			],
			securityRequirements: "high",
			redundancyNeeds: "medium",
		},
		{
			name: "Construction & Mining",
			targetAudienceId: 104,
			commonNeeds: [
				"Remote site connectivity",
				"Mobile access",
				"Rugged solutions",
			],
			priorityCategories: ["Satellite Internet", "Data", "Managed Services"],
			securityRequirements: "medium",
			redundancyNeeds: "medium",
		},
	];

	/**
	 * Generate intelligent fallback recommendations based on minimal user input
	 */
	public generateScenarioBasedRecommendations(
		userMessage: string,
		availableProducts: EnrichedItem[]
	): {
		primaryRecommendation: string;
		scenarios: Array<{
			scenario: BusinessScenario;
			matchingProducts: EnrichedItem[];
			recommendationText: string;
		}>;
		industrySpecific?: {
			industry: IndustryProfile;
			matchingProducts: EnrichedItem[];
			recommendationText: string;
		};
	} {
		// Analyze user message for hints
		const messageAnalysis = this.analyzeUserMessage(userMessage);

		// Generate scenario-based recommendations
		const scenarioRecommendations = this.businessScenarios.map((scenario) => {
			const matchingProducts = this.findMatchingProducts(
				scenario,
				availableProducts
			);
			return {
				scenario,
				matchingProducts: matchingProducts.slice(0, 3), // Top 3 per scenario
				recommendationText: this.generateScenarioText(
					scenario,
					matchingProducts.slice(0, 3)
				),
			};
		});

		// Check for industry-specific recommendations
		let industrySpecific = undefined;
		if (messageAnalysis.detectedIndustry) {
			const industry = messageAnalysis.detectedIndustry;
			const matchingProducts = this.findIndustryProducts(
				industry,
				availableProducts
			);
			industrySpecific = {
				industry,
				matchingProducts: matchingProducts.slice(0, 3),
				recommendationText: this.generateIndustryText(
					industry,
					matchingProducts.slice(0, 3)
				),
			};
		}

		// Generate primary recommendation text
		const primaryRecommendation = this.generatePrimaryRecommendationText(
			messageAnalysis,
			scenarioRecommendations,
			industrySpecific
		);

		return {
			primaryRecommendation,
			scenarios: scenarioRecommendations,
			industrySpecific,
		};
	}

	public analyzeUserMessage(message: string): {
		urgency: "low" | "medium" | "high";
		detectedKeywords: string[];
		detectedIndustry?: IndustryProfile;
		businessSizeHints: string[];
	} {
		const lowerMessage = message.toLowerCase();

		// Detect urgency indicators
		const urgencyKeywords = [
			"urgent",
			"asap",
			"immediately",
			"now",
			"fast",
			"quick",
		];
		const urgency = urgencyKeywords.some((keyword) =>
			lowerMessage.includes(keyword)
		)
			? "high"
			: "low";

		// Detect industry keywords
		const detectedIndustry = this.industryProfiles.find((industry) => {
			const industryKeywords = {
				Hospitality: ["hotel", "hospitality", "guest", "resort", "restaurant"],
				"Banking & Financial Services": [
					"bank",
					"finance",
					"financial",
					"trading",
					"payment",
				],
				"Government & Retail": [
					"government",
					"retail",
					"store",
					"shop",
					"public",
				],
				"Construction & Mining": [
					"construction",
					"mining",
					"site",
					"field",
					"remote",
				],
			};

			const keywords =
				industryKeywords[industry.name as keyof typeof industryKeywords] || [];
			return keywords.some((keyword) => lowerMessage.includes(keyword));
		});

		// Detect business size hints
		const businessSizeHints: string[] = [];
		if (lowerMessage.includes("small") || lowerMessage.includes("startup")) {
			businessSizeHints.push("small");
		}
		if (lowerMessage.includes("enterprise") || lowerMessage.includes("large")) {
			businessSizeHints.push("large");
		}
		if (lowerMessage.includes("branch") || lowerMessage.includes("office")) {
			businessSizeHints.push("branch");
		}

		// Extract relevant keywords
		const detectedKeywords = [
			"fiber",
			"internet",
			"broadband",
			"wifi",
			"security",
			"cloud",
			"fast",
			"speed",
			"reliable",
			"backup",
			"redundant",
		].filter((keyword) => lowerMessage.includes(keyword));

		return {
			urgency,
			detectedKeywords,
			detectedIndustry,
			businessSizeHints,
		};
	}

	private findMatchingProducts(
		scenario: BusinessScenario,
		products: EnrichedItem[]
	): EnrichedItem[] {
		return products
			.filter((product) => {
				// Match by category
				const categoryMatch = scenario.recommendedCategories.some((cat) =>
					product.parentItem?.name?.toLowerCase().includes(cat.toLowerCase())
				);

				// Match by product name
				const productMatch = scenario.recommendedProducts.some((prodName) =>
					product.name?.toLowerCase().includes(prodName.toLowerCase())
				);

				return categoryMatch || productMatch;
			})
			.sort((a, b) => {
				// Prioritize products with pricing (more specific)
				if (a.price && !b.price) return -1;
				if (!a.price && b.price) return 1;
				return 0;
			});
	}

	private findIndustryProducts(
		industry: IndustryProfile,
		products: EnrichedItem[]
	): EnrichedItem[] {
		return products
			.filter((product) => {
				// Match by target audience
				const audienceMatch =
					product.targetAudience?.id === industry.targetAudienceId;

				// Match by priority categories
				const categoryMatch = industry.priorityCategories.some((cat) =>
					product.parentItem?.name?.toLowerCase().includes(cat.toLowerCase())
				);

				return audienceMatch || categoryMatch;
			})
			.sort((a, b) => {
				// Prioritize audience matches
				const aAudienceMatch =
					a.targetAudience?.id === industry.targetAudienceId;
				const bAudienceMatch =
					b.targetAudience?.id === industry.targetAudienceId;

				if (aAudienceMatch && !bAudienceMatch) return -1;
				if (!aAudienceMatch && bAudienceMatch) return 1;
				return 0;
			});
	}

	private generateScenarioText(
		scenario: BusinessScenario,
		products: EnrichedItem[]
	): string {
		if (products.length === 0) {
			return `For ${scenario.description} (${
				scenario.employeeRange
			}), I'd typically recommend solutions in ${scenario.recommendedCategories.join(
				" or "
			)}.`;
		}

		const productList = products
			.map((p) => {
				const priceText = p.price
					? ` (₱${Number(p.price).toLocaleString()}/month)`
					: "";
				return `**${p.name}**${priceText}`;
			})
			.join(", ");

		return `**${scenario.name}** (${scenario.employeeRange}):
Assuming you need ${
			scenario.assumedBandwidth
		} for ${scenario.description.toLowerCase()}, I'd recommend: ${productList}.
${scenario.reasoning}`;
	}

	private generateIndustryText(
		industry: IndustryProfile,
		products: EnrichedItem[]
	): string {
		if (products.length === 0) {
			return `For ${
				industry.name
			} businesses, I'd typically focus on ${industry.priorityCategories.join(
				", "
			)} solutions with ${
				industry.securityRequirements
			} security requirements.`;
		}

		const productList = products
			.map((p) => {
				const priceText = p.price
					? ` (₱${Number(p.price).toLocaleString()}/month)`
					: "";
				return `**${p.name}**${priceText}`;
			})
			.join(", ");

		return `**${industry.name} Industry Focus**: 
Given your industry's needs for ${industry.commonNeeds.join(
			", "
		)}, I'd recommend: ${productList}.
These solutions provide ${industry.securityRequirements}-level security and ${
			industry.redundancyNeeds
		}-level redundancy typical for ${industry.name.toLowerCase()} businesses.`;
	}

	private generatePrimaryRecommendationText(
		analysis: {
			urgency: "low" | "medium" | "high";
			detectedKeywords: string[];
			detectedIndustry?: IndustryProfile;
			businessSizeHints: string[];
		},
		scenarios: Array<{
			scenario: BusinessScenario;
			matchingProducts: EnrichedItem[];
			recommendationText: string;
		}>,
		industrySpecific?: {
			industry: IndustryProfile;
			matchingProducts: EnrichedItem[];
			recommendationText: string;
		}
	): string {
		let intro =
			"I understand you need a telecommunications solution! Since I'd like to give you the most relevant recommendations, here are some options based on common business scenarios:\n\n";

		if (analysis.urgency === "high") {
			intro =
				"I can see you need a solution quickly! Here are immediate options based on typical business needs:\n\n";
		}

		if (industrySpecific) {
			intro += `**Industry-Specific Recommendation:**\n${industrySpecific.recommendationText}\n\n`;
		}

		intro += "**General Business Scenarios:**\n";

		scenarios.forEach((scenario) => {
			intro += `\n${scenario.recommendationText}\n`;
		});

		intro +=
			"\n💡 **Next Step**: If any of these scenarios match your situation, I can provide more detailed information about the specific products and help you get started!";

		return intro;
	}
}
