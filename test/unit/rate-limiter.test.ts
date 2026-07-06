// test/unit/rate-limiter.test.ts

import { describe, it, expect, vi, afterEach } from "vitest";
import { RateLimiter } from "../../src/utils/rate-limiter.js";

describe("RateLimiter", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	describe("isAllowed", () => {
		it("allows the first N requests and rejects the N+1th within the window", () => {
			const limiter = new RateLimiter(3, 1000);
			expect(limiter.isAllowed("k")).toBe(true);
			expect(limiter.isAllowed("k")).toBe(true);
			expect(limiter.isAllowed("k")).toBe(true);
			expect(limiter.isAllowed("k")).toBe(false);
			limiter.destroy();
		});

		it("isolates counts per key", () => {
			const limiter = new RateLimiter(1, 1000);
			expect(limiter.isAllowed("alice")).toBe(true);
			expect(limiter.isAllowed("alice")).toBe(false);
			expect(limiter.isAllowed("bob")).toBe(true);
			limiter.destroy();
		});
	});

	describe("retryAfterMs", () => {
		it("returns 0 when no requests have been made", () => {
			const limiter = new RateLimiter(2, 1000);
			expect(limiter.retryAfterMs("k")).toBe(0);
			limiter.destroy();
		});

		it("returns 0 when under the limit", () => {
			const limiter = new RateLimiter(2, 1000);
			limiter.isAllowed("k");
			expect(limiter.retryAfterMs("k")).toBe(0);
			limiter.destroy();
		});

		it("returns the wait until the oldest timestamp exits the window when at the limit", () => {
			vi.useFakeTimers();
			vi.setSystemTime(0);
			const limiter = new RateLimiter(2, 1000);
			limiter.isAllowed("k"); // t=0
			vi.setSystemTime(300);
			limiter.isAllowed("k"); // t=300
			vi.setSystemTime(500);
			// oldest is t=0; window is 1000ms so it exits at t=1000 → waitMs=500
			expect(limiter.retryAfterMs("k")).toBe(500);
			limiter.destroy();
		});

		it("never returns a negative value", () => {
			vi.useFakeTimers();
			vi.setSystemTime(0);
			const limiter = new RateLimiter(1, 1000);
			limiter.isAllowed("k");
			vi.setSystemTime(5000);
			// Oldest timestamp is out of window; effectively no wait
			expect(limiter.retryAfterMs("k")).toBe(0);
			limiter.destroy();
		});
	});
});
