import { describe, it, expect } from "vitest";
import type {
	ContextMetrics,
	ContextMethod,
	ContextMetricsSummary,
} from "../../src/types/metrics.types.js";

describe("Metrics Type Definitions", () => {
	describe("ContextMethod Type", () => {
		it("should define both context methods", () => {
			const intelligent: ContextMethod = "intelligent";
			const simple: ContextMethod = "simple";

			expect(intelligent).toBe("intelligent");
			expect(simple).toBe("simple");
		});

		it("should only allow defined methods", () => {
			const method: ContextMethod = "intelligent";
			expect(["intelligent", "simple"]).toContain(method);
		});
	});

	describe("ContextMetrics Type", () => {
		it("should define complete metrics structure", () => {
			const metrics: ContextMetrics = {
				sessionId: "session-123",
				method: "intelligent",
				totalTurns: 10,
				selectedTurns: 5,
				relevanceScores: [8.5, 7.0, 9.0, 6.5, 8.0],
				hasSummary: true,
				processingTimeMs: 450,
				timestamp: new Date(),
			};

			expect(metrics.sessionId).toBe("session-123");
			expect(metrics.method).toBe("intelligent");
			expect(metrics.totalTurns).toBe(10);
			expect(metrics.selectedTurns).toBe(5);
			expect(metrics.relevanceScores).toHaveLength(5);
			expect(metrics.hasSummary).toBe(true);
			expect(metrics.processingTimeMs).toBeGreaterThan(0);
			expect(metrics.timestamp).toBeInstanceOf(Date);
		});

		it("should allow undefined relevanceScores for simple method", () => {
			const metrics: ContextMetrics = {
				sessionId: "session-456",
				method: "simple",
				totalTurns: 5,
				selectedTurns: 5,
				hasSummary: false,
				processingTimeMs: 10,
				timestamp: new Date(),
			};

			expect(metrics.relevanceScores).toBeUndefined();
			expect(metrics.method).toBe("simple");
		});

		it("should track selection ratios", () => {
			const metrics: ContextMetrics = {
				sessionId: "session-789",
				method: "intelligent",
				totalTurns: 15,
				selectedTurns: 7,
				relevanceScores: [9, 8, 7, 8, 6, 7, 8],
				hasSummary: true,
				processingTimeMs: 500,
				timestamp: new Date(),
			};

			const selectionRatio = metrics.selectedTurns / metrics.totalTurns;
			expect(selectionRatio).toBeGreaterThan(0);
			expect(selectionRatio).toBeLessThanOrEqual(1);
			expect(selectionRatio).toBeCloseTo(0.47, 2);
		});

		it("should handle zero processing time", () => {
			const metrics: ContextMetrics = {
				sessionId: "session-quick",
				method: "simple",
				totalTurns: 1,
				selectedTurns: 1,
				hasSummary: false,
				processingTimeMs: 0,
				timestamp: new Date(),
			};

			expect(metrics.processingTimeMs).toBe(0);
		});
	});

	describe("ContextMetricsSummary Type", () => {
		it("should define summary structure with aggregated data", () => {
			const summary: ContextMetricsSummary = {
				timeRange: "24h",
				totalSessions: 100,
				intelligentCount: 60,
				simpleCount: 40,
				averageTotalTurns: 8.5,
				averageSelectedTurns: 5.2,
				averageProcessingTimeMs: 420,
				tokenSavingsPercent: 35,
			};

			expect(summary.timeRange).toBe("24h");
			expect(summary.totalSessions).toBe(
				summary.intelligentCount + summary.simpleCount
			);
			expect(summary.averageSelectedTurns).toBeLessThanOrEqual(
				summary.averageTotalTurns
			);
			expect(summary.averageProcessingTimeMs).toBeGreaterThan(0);
			expect(summary.tokenSavingsPercent).toBeGreaterThan(0);
		});

		it("should handle zero intelligent context usage", () => {
			const summary: ContextMetricsSummary = {
				timeRange: "1h",
				totalSessions: 50,
				intelligentCount: 0,
				simpleCount: 50,
				averageTotalTurns: 5.0,
				averageSelectedTurns: 5.0,
				averageProcessingTimeMs: 10,
				tokenSavingsPercent: 0,
			};

			expect(summary.intelligentCount).toBe(0);
			expect(summary.simpleCount).toBe(50);
			expect(summary.tokenSavingsPercent).toBe(0);
		});

		it("should calculate usage percentages", () => {
			const summary: ContextMetricsSummary = {
				timeRange: "7d",
				totalSessions: 1000,
				intelligentCount: 750,
				simpleCount: 250,
				averageTotalTurns: 10.2,
				averageSelectedTurns: 6.5,
				averageProcessingTimeMs: 380,
				tokenSavingsPercent: 42,
			};

			const intelligentPercent =
				(summary.intelligentCount / summary.totalSessions) * 100;
			const simplePercent = (summary.simpleCount / summary.totalSessions) * 100;

			expect(intelligentPercent).toBe(75);
			expect(simplePercent).toBe(25);
			expect(intelligentPercent + simplePercent).toBe(100);
		});

		it("should show selection efficiency", () => {
			const summary: ContextMetricsSummary = {
				timeRange: "30d",
				totalSessions: 5000,
				intelligentCount: 4000,
				simpleCount: 1000,
				averageTotalTurns: 12.5,
				averageSelectedTurns: 7.0,
				averageProcessingTimeMs: 450,
				tokenSavingsPercent: 48,
			};

			const selectionRatio =
				summary.averageSelectedTurns / summary.averageTotalTurns;
			expect(selectionRatio).toBeCloseTo(0.56, 2);
			expect(summary.tokenSavingsPercent).toBeGreaterThan(40);
		});
	});

	describe("Metrics Aggregation", () => {
		it("should aggregate multiple ContextMetrics into summary", () => {
			const metricsList: ContextMetrics[] = [
				{
					sessionId: "s1",
					method: "intelligent",
					totalTurns: 10,
					selectedTurns: 6,
					hasSummary: true,
					processingTimeMs: 400,
					timestamp: new Date(),
				},
				{
					sessionId: "s2",
					method: "intelligent",
					totalTurns: 8,
					selectedTurns: 5,
					hasSummary: false,
					processingTimeMs: 300,
					timestamp: new Date(),
				},
				{
					sessionId: "s3",
					method: "simple",
					totalTurns: 5,
					selectedTurns: 5,
					hasSummary: false,
					processingTimeMs: 10,
					timestamp: new Date(),
				},
			];

			const intelligentCount = metricsList.filter(
				(m) => m.method === "intelligent"
			).length;
			const simpleCount = metricsList.filter(
				(m) => m.method === "simple"
			).length;
			const avgTotalTurns =
				metricsList.reduce((sum, m) => sum + m.totalTurns, 0) /
				metricsList.length;
			const avgProcessingTime =
				metricsList.reduce((sum, m) => sum + m.processingTimeMs, 0) /
				metricsList.length;

			expect(intelligentCount).toBe(2);
			expect(simpleCount).toBe(1);
			expect(avgTotalTurns).toBeCloseTo(7.67, 2);
			expect(avgProcessingTime).toBeCloseTo(236.67, 2);
		});
	});

	describe("Type Safety", () => {
		it("should enforce required fields in ContextMetrics", () => {
			// This is a compile-time check, but we can verify structure
			const metrics: ContextMetrics = {
				sessionId: "test",
				method: "intelligent",
				totalTurns: 10,
				selectedTurns: 5,
				hasSummary: false,
				processingTimeMs: 100,
				timestamp: new Date(),
			};

			const requiredFields: (keyof ContextMetrics)[] = [
				"sessionId",
				"method",
				"totalTurns",
				"selectedTurns",
				"hasSummary",
				"processingTimeMs",
				"timestamp",
			];

			requiredFields.forEach((field) => {
				expect(metrics[field]).toBeDefined();
			});
		});

		it("should enforce required fields in ContextMetricsSummary", () => {
			const summary: ContextMetricsSummary = {
				timeRange: "24h",
				totalSessions: 100,
				intelligentCount: 60,
				simpleCount: 40,
				averageTotalTurns: 8,
				averageSelectedTurns: 5,
				averageProcessingTimeMs: 400,
				tokenSavingsPercent: 30,
			};

			const requiredFields: (keyof ContextMetricsSummary)[] = [
				"timeRange",
				"totalSessions",
				"intelligentCount",
				"simpleCount",
				"averageTotalTurns",
				"averageSelectedTurns",
				"averageProcessingTimeMs",
				"tokenSavingsPercent",
			];

			requiredFields.forEach((field) => {
				expect(summary[field]).toBeDefined();
			});
		});
	});
});
