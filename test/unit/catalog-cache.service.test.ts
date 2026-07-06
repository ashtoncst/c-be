import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { CatalogCacheService } from "../../src/services/catalog-cache.service.js";
import type { CatalogItem } from "../../src/types/catalog.types.js";

// Mock Logger class
vi.mock("../../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		log: vi.fn(),
	})),
}));

// Mock logger
vi.mock("../../src/logger-config.js", () => ({
	logger: {
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

// Mock database
vi.mock("../../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		leftJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockResolvedValue([
			{
				id: 1,
				name: "Test Item",
				description: "Test Description",
				itemType: "product",
				parentItemId: null,
				price: "100",
				contractTerm: "12 months",
				targetAudienceId: null,
			},
		]),
	},
}));

describe("CatalogCacheService", () => {
	let service: CatalogCacheService;

	beforeEach(() => {
		// Reset singleton instance for each test
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		(CatalogCacheService as any).instance = null;
		service = CatalogCacheService.getInstance();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("Singleton Pattern", () => {
		it("should return the same instance", () => {
			const instance1 = CatalogCacheService.getInstance();
			const instance2 = CatalogCacheService.getInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe("getCatalog", () => {
		it("should fetch catalog from database on first call", async () => {
			const mockItems: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 8,
					name: "Fiber Broadband",
					description: "Fast fiber",
					type: "category",
					parentId: 1,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			// Mock DB response
			const { db } = await import("../../src/db/index.js");
			vi.mocked(db.orderBy).mockResolvedValue(mockItems);

			const catalog = await service.getCatalog();

			// getCatalog returns CatalogData {flat, hierarchical, metadata}
			expect(catalog).toHaveProperty("flat");
			expect(catalog).toHaveProperty("hierarchical");
			expect(catalog).toHaveProperty("metadata");
			expect(catalog.flat).toEqual(mockItems);
			expect(catalog.flat.length).toBe(2);
		});

		it("should return cached catalog on second call within TTL", async () => {
			const mockItems: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const { db } = await import("../../src/db/index.js");
			vi.mocked(db.orderBy).mockResolvedValue(mockItems);

			// First call
			const catalog1 = await service.getCatalog();
			const dbCallCount1 = vi.mocked(db.orderBy).mock.calls.length;

			// Second call (should use cache)
			const catalog2 = await service.getCatalog();
			const dbCallCount2 = vi.mocked(db.orderBy).mock.calls.length;

			expect(catalog1).toEqual(catalog2);
			expect(dbCallCount2).toBe(dbCallCount1); // No additional DB call
		});

		it("should have TTL of 5 minutes", () => {
			const stats = service.getCacheStats();
			expect(stats.ttlMs).toBe(5 * 60 * 1000); // 5 minutes in milliseconds
		});
	});

	describe("refreshCache", () => {
		it("should clear cache and fetch fresh data", async () => {
			const mockItems: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const { db } = await import("../../src/db/index.js");
			vi.mocked(db.orderBy).mockResolvedValue(mockItems);

			// First call
			await service.getCatalog();
			const callCount1 = vi.mocked(db.orderBy).mock.calls.length;

			// Refresh cache
			await service.refreshCache();
			const callCount2 = vi.mocked(db.orderBy).mock.calls.length;

			expect(callCount2).toBeGreaterThan(callCount1);
		});
	});

	describe("buildHierarchy", () => {
		it("should organize flat catalog into hierarchical structure", () => {
			const flatCatalog: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 8,
					name: "Fiber Broadband",
					description: "Fast fiber",
					type: "category",
					parentId: 1,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
				{
					id: 33,
					name: "Fiber Broadband PEAK 50-100 mbps",
					description: "50-100 mbps plan",
					type: "product",
					parentId: 8,
					price: "1500",
					contractTerm: "12 months",
					targetAudienceId: 1,
				},
			];

			const hierarchy = service.buildHierarchy(flatCatalog);

			expect(hierarchy).toHaveLength(1); // 1 solution
			expect(hierarchy[0].name).toBe("Internet");
			expect(hierarchy[0].categories).toHaveLength(1); // 1 category
			expect(hierarchy[0].categories[0].name).toBe("Fiber Broadband");
			expect(hierarchy[0].categories[0].products).toHaveLength(1); // 1 product
			expect(hierarchy[0].categories[0].products[0].name).toBe(
				"Fiber Broadband PEAK 50-100 mbps"
			);
		});

		it("should handle empty catalog", () => {
			const hierarchy = service.buildHierarchy([]);
			expect(hierarchy).toHaveLength(0);
		});

		it("should handle orphaned categories and products", () => {
			const catalogWithOrphans: CatalogItem[] = [
				{
					id: 8,
					name: "Orphan Category",
					description: "No parent",
					type: "category",
					parentId: 999, // Non-existent parent
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const hierarchy = service.buildHierarchy(catalogWithOrphans);
			expect(hierarchy).toHaveLength(0); // No solutions, so empty
		});
	});

	describe("getCacheStats", () => {
		it("should return cache statistics", () => {
			const stats = service.getCacheStats();

			expect(stats).toHaveProperty("isCached");
			expect(stats).toHaveProperty("itemCount");
			expect(stats).toHaveProperty("lastFetch");
			expect(stats).toHaveProperty("ttlMs");
			expect(stats).toHaveProperty("expiresAt");
		});

		it("should show not cached initially", () => {
			const stats = service.getCacheStats();

			expect(stats.isCached).toBe(false);
			expect(stats.itemCount).toBe(0);
			expect(stats.lastFetch).toBeNull();
			expect(stats.expiresAt).toBeNull();
		});

		it("should show cached after getCatalog", async () => {
			const mockItems: CatalogItem[] = [
				{
					id: 1,
					name: "Internet",
					description: "High-speed internet",
					type: "solution",
					parentId: null,
					price: null,
					contractTerm: null,
					targetAudienceId: null,
				},
			];

			const { db } = await import("../../src/db/index.js");
			vi.mocked(db.orderBy).mockResolvedValue(mockItems);

			await service.getCatalog();
			const stats = service.getCacheStats();

			expect(stats.isCached).toBe(true);
			expect(stats.itemCount).toBe(1);
			expect(stats.lastFetch).not.toBeNull();
			expect(stats.expiresAt).not.toBeNull();
		});
	});
});

