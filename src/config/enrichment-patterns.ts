// src/config/enrichment-patterns.ts
import type { EnrichmentPattern } from "../types/enrichment.types.js";

/**
 * Detect security category based on deployment model keywords
 */
function detectSecurityCategory(message: string): string | undefined {
	const lower = message.toLowerCase();
	if (/(on\s*-?prem|on\s*premise)/i.test(lower)) {
		return "On-Premise Defense";
	}
	if (/hybrid/i.test(lower)) {
		return "Hybrid Defenses";
	}
	if (/cloud/i.test(lower)) {
		return "Cloud Defenses";
	}
	return undefined;
}

/**
 * Get predicted products based on hotel room count
 */
function getPredictedProductsForHotel(rooms: number): string[] {
	const products: string[] = [];

	if (rooms < 30) {
		products.push("Fiber Broadband PEAK 50-100 mbps", "Managed Wi-Fi Premium");
	} else if (rooms < 100) {
		products.push("Fiber Broadband PEAK 200-400 mbps", "Managed Wi-Fi Premium");
	} else {
		products.push("Fiber Dedicated", "Managed Wi-Fi Enterprise");
	}

	return products;
}

/**
 * Consolidated enrichment patterns
 * Ordered by priority (highest first)
 */
export const ENRICHMENT_PATTERNS: EnrichmentPattern[] = [
	// ═══════════════════════════════════════════════════════════════
	// HIGH PRIORITY: Security & DDoS (25-20)
	// ═══════════════════════════════════════════════════════════════
	{
		id: "security-ddos",
		priority: 25,
		description: "DDoS protection queries → Security Anti-DDos",
		trigger:
			/\b(ddos|anti-?ddos|denial of service|attack mitigation|scrubbing|ddos protection|ddos defence|ddos defense)\b/i,
		enrich: (msg: string) => ({
			solution: "Security Anti-DDos",
			category: detectSecurityCategory(msg),
			confidence_level: "high" as const,
		}),
	},

	// ═══════════════════════════════════════════════════════════════
	// HIGH PRIORITY: Composite patterns (20-15)
	// ═══════════════════════════════════════════════════════════════
	{
		id: "hotel-wifi-composite",
		priority: 20,
		description: "Hotel + rooms + wifi → Hospitality + Managed Wi-Fi",
		trigger:
			/(\d+)\s*(?:room|rooms).*(?:guest|customer|visitor)\s*(?:wifi|wi-fi|internet)/i,
		enrich: (msg: string) => {
			const match = msg.match(/(\d+)\s*rooms?/i);
			const rooms = match ? parseInt(match[1]) : 0;
			const hasStreaming = /(?:tv|television|streaming|netflix|content)/i.test(
				msg
			);

			const predicted = getPredictedProductsForHotel(rooms);
			if (hasStreaming) {
				predicted.push("Live Tv");
			}

			return {
				target_audience: "Hospitality",
				num_users: rooms * 2,
				contextual_scale: (rooms < 30
					? "small"
					: rooms < 100
					? "medium"
					: "large") as "small" | "medium" | "large",
				solution: "Internet",
				category: "Managed Wi-Fi",
				primary_use: hasStreaming
					? ["guest_wifi", "streaming"]
					: ["guest_wifi"],
				predicted_products: predicted,
				confidence_level: "high" as const,
			};
		},
	},

	{
		id: "retail-pos-composite",
		priority: 19,
		description: "Retail stores + POS → Internet + Managed Wi-Fi",
		trigger:
			/(\d+)\s*(?:store|stores|shop|shops|branch|branches).*(?:pos|point of sale|payment)/i,
		enrich: (msg: string) => {
			const match = msg.match(
				/(\d+)\s*(?:store|stores|shop|shops|branch|branches)/i
			);
			const storeCount = match ? parseInt(match[1]) : 0;
			const hasSurveillance = /(?:camera|cctv|surveillance|security)/i.test(
				msg
			);

			const predicted: string[] = [
				"Fiber Broadband PEAK 50-100 mbps",
				"Managed Wi-Fi Premium",
			];
			if (hasSurveillance) {
				predicted.push("Managed Surveillance");
			}

			return {
				target_audience: "Government & Retails",
				solution: "Internet",
				category: "Managed Wi-Fi",
				contextual_scale: (storeCount < 5
					? "small"
					: storeCount < 20
					? "medium"
					: "large") as "small" | "medium" | "large",
				primary_use: ["pos", "customer_wifi"],
				predicted_products: predicted,
				confidence_level: "high" as const,
			};
		},
	},

	// ═══════════════════════════════════════════════════════════════
	// MEDIUM PRIORITY: Solution detection (15-10)
	// ═══════════════════════════════════════════════════════════════
	{
		id: "solution-transport",
		priority: 15,
		description: "Transport/WAN/VPN keywords → Transport",
		trigger:
			/\b(transport|wan|mpls|vpn|site\s*to\s*site|epls|l2vpn|ip\s*vpn)\b/i,
		enrich: () => ({
			solution: "Transport",
		}),
	},

	{
		id: "solution-internet",
		priority: 15,
		description: "Internet/broadband keywords → Internet",
		trigger: /\b(internet|broadband|fiber|connectivity)\b/i,
		enrich: () => ({
			solution: "Internet",
		}),
	},

	{
		id: "solution-satellite",
		priority: 15,
		description: "Satellite/Starlink keywords → Satellite",
		trigger: /\b(satellite|starlink)\b/i,
		enrich: () => ({
			solution: "Satellite",
		}),
	},

	{
		id: "solution-content",
		priority: 15,
		description: "Content/IPTV keywords → Content",
		trigger: /\b(content|tv|iptv|streaming|hospitality\s*tv)\b/i,
		enrich: () => ({
			solution: "Content",
		}),
	},

	{
		id: "solution-managed-services",
		priority: 15,
		description: "Managed services keywords → Managed Services",
		trigger: /\b(managed|sd-?wan|surveillance|draas)\b/i,
		enrich: () => ({
			solution: "Managed Services",
		}),
	},

	{
		id: "solution-colocation",
		priority: 15,
		description: "Colocation/datacenter keywords → Colocation",
		trigger: /\b(colo|colocation|data\s*center|datacenter)\b/i,
		enrich: () => ({
			solution: "Colocation Data Centers",
		}),
	},

	{
		id: "solution-cable-systems",
		priority: 15,
		description: "Cable/submarine keywords → Cable Systems",
		trigger: /\b(cable\s*system|submarine|bifrost|sea-?h2x|undersea)\b/i,
		enrich: () => ({
			solution: "Cable Systems",
		}),
	},

	{
		id: "solution-cloud-ai",
		priority: 15,
		description: "Cloud/AI/cybersecurity keywords → Cloud, AI & Cybersecurity",
		trigger: /\b(managed\s*cloud|sovereign\s*cloud|app\s*studio|secops)\b/i,
		enrich: () => ({
			solution: "Cloud, AI & Cybersecurity",
		}),
	},

	// ═══════════════════════════════════════════════════════════════
	// LOW PRIORITY: Category hints (10-1)
	// ═══════════════════════════════════════════════════════════════
	{
		id: "category-vpn",
		priority: 10,
		description: "VPN/MPLS keywords → IP VPN category",
		trigger: /\b(vpn|mpls|ip\s*vpn)\b/i,
		enrich: () => ({
			solution: "Transport",
			category: "IP VPN",
		}),
	},

	{
		id: "category-fiber-broadband",
		priority: 10,
		description: "Fiber broadband keywords → Fiber Broadband",
		trigger: /\b(fiber\s*broadband)\b/i,
		enrich: () => ({
			solution: "Internet",
			category: "Fiber Broadband",
		}),
	},

	{
		id: "category-dedicated-internet",
		priority: 10,
		description: "Dedicated internet keywords → Fiber Dedicated",
		trigger: /\b(dedicated\s*internet|dia|fiber\s*dedicated)\b/i,
		enrich: () => ({
			solution: "Internet",
			category: "Fiber Dedicated",
		}),
	},

	{
		id: "category-managed-wifi",
		priority: 10,
		description: "Wi-Fi keywords → Managed Wi-Fi",
		trigger: /\b(wifi|wi-?fi|managed\s*wifi)\b/i,
		enrich: () => ({
			category: "Managed Wi-Fi",
		}),
	},

	{
		id: "category-sd-wan",
		priority: 10,
		description: "SD-WAN keywords → SD-WAN",
		trigger: /\b(sd-?wan|sdwan)\b/i,
		enrich: () => ({
			solution: "Transport",
			category: "SD-WAN",
		}),
	},

	// ═══════════════════════════════════════════════════════════════
	// LOW PRIORITY: Audience detection (5-1)
	// ═══════════════════════════════════════════════════════════════
	{
		id: "audience-hospitality",
		priority: 5,
		description: "Hotel/restaurant keywords → Hospitality",
		trigger: /\b(hotel|restaurant|hospitality|resort|guest)\b/i,
		enrich: () => ({
			target_audience: "Hospitality",
		}),
	},

	{
		id: "audience-retail",
		priority: 5,
		description: "Retail/store keywords → Government & Retails",
		trigger: /\b(retail|store|shop|pos|point of sale)\b/i,
		enrich: () => ({
			target_audience: "Government & Retails",
		}),
	},

	{
		id: "audience-banking",
		priority: 5,
		description: "Banking/finance keywords → Banking & Financial Services",
		trigger: /\b(bank|banking|finance|financial\s*services)\b/i,
		enrich: () => ({
			target_audience: "Banking & Financial Services",
		}),
	},

	{
		id: "audience-enterprise",
		priority: 5,
		description: "Enterprise keywords → Enterprise",
		trigger: /\b(enterprise|large\s*business|corporation)\b/i,
		enrich: () => ({
			target_audience: "Enterprise",
		}),
	},

	{
		id: "audience-sme",
		priority: 5,
		description: "SME/small business keywords → SME",
		trigger: /\b(sme|small\s*business|small\s*to\s*medium)\b/i,
		enrich: () => ({
			target_audience: "SME",
		}),
	},
];
