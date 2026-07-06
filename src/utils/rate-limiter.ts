/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks request timestamps per key (session ID, IP address, etc.)
 * and rejects requests that exceed the configured threshold within
 * the sliding window. A periodic cleanup runs every 60 seconds to
 * evict expired entries and prevent memory growth.
 */
export class RateLimiter {
	private windows = new Map<string, number[]>();
	private cleanupInterval: ReturnType<typeof setInterval>;

	constructor(
		private maxRequests: number,
		private windowMs: number
	) {
		this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
	}

	isAllowed(key: string): boolean {
		const now = Date.now();
		const windowStart = now - this.windowMs;

		const timestamps = (this.windows.get(key) || []).filter(
			(t) => t > windowStart
		);

		if (timestamps.length >= this.maxRequests) {
			this.windows.set(key, timestamps);
			return false;
		}

		timestamps.push(now);
		this.windows.set(key, timestamps);
		return true;
	}

	/**
	 * Milliseconds until the caller could next hit `isAllowed` and get true.
	 * Returns 0 if the caller is currently under the limit.
	 */
	retryAfterMs(key: string): number {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		const timestamps = (this.windows.get(key) || []).filter(
			(t) => t > windowStart
		);
		if (timestamps.length < this.maxRequests) return 0;
		const oldest = timestamps[0];
		return Math.max(0, oldest + this.windowMs - now);
	}

	private cleanup(): void {
		const now = Date.now();
		for (const [key, timestamps] of this.windows) {
			const valid = timestamps.filter((t) => t > now - this.windowMs);
			if (valid.length === 0) {
				this.windows.delete(key);
			} else {
				this.windows.set(key, valid);
			}
		}
	}

	destroy(): void {
		clearInterval(this.cleanupInterval);
	}
}
