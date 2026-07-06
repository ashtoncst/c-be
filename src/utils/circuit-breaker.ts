import { Logger } from "./logger.js";
import { AppError } from "../middleware/errorHandler.js";

export interface CircuitBreakerConfig {
	serviceName: string;
	failureThreshold: number;
	recoveryTimeout: number; // ms
	recoveryThreshold: number; // successful calls needed to close circuit
	healthCheckInterval?: number; // ms
	customHealthCheck?: () => Promise<boolean>;
}

export interface CircuitBreakerState {
	state: "CLOSED" | "OPEN" | "HALF_OPEN";
	failureCount: number;
	lastFailureTime: number;
	consecutiveSuccesses: number;
	lastHealthCheck: number;
}

export interface CircuitBreakerMetrics {
	serviceName: string;
	state: string;
	failureCount: number;
	successCount: number;
	lastFailureTime: number;
	consecutiveSuccesses: number;
	uptimePercentage: number;
	totalOperations: number;
	uptimeMs: number;
	uptimeDuration: string;
}

/**
 * ✅ REUSABLE: Generic Circuit Breaker implementation following error-logger patterns
 */
export class CircuitBreaker {
	private state: CircuitBreakerState;
	private config: Required<CircuitBreakerConfig>;
	private logger: Logger;
	private metrics = {
		totalOperations: 0,
		totalSuccesses: 0,
		totalFailures: 0,
		startTime: Date.now(),
	};

	constructor(config: CircuitBreakerConfig) {
		this.config = {
			healthCheckInterval: 30000, // 30 seconds default
			customHealthCheck: async () => true, // Default no-op health check
			...config,
		};

		this.state = {
			state: "CLOSED",
			failureCount: 0,
			lastFailureTime: 0,
			consecutiveSuccesses: 0,
			lastHealthCheck: 0,
		};

		this.logger = new Logger({
			serviceName: `CircuitBreaker-${config.serviceName}`,
		});

		this.logger.info("Circuit breaker initialized", {
			serviceName: config.serviceName,
			failureThreshold: config.failureThreshold,
			recoveryTimeout: config.recoveryTimeout,
			recoveryThreshold: config.recoveryThreshold,
			operation: "circuitBreakerInitialization",
		});
	}

	/**
	 * ✅ TYPED: Check if operation should be allowed through circuit breaker
	 */
	public async shouldAllowOperation(operationId?: string): Promise<{
		allowed: boolean;
		reason?: string;
		state: string;
	}> {
		const now = Date.now();

		// Update state based on timeout
		await this.updateStateBasedOnTime(now);

		// Run health check if needed
		await this.runHealthCheckIfNeeded(now);

		const result = {
			allowed: this.state.state !== "OPEN",
			reason:
				this.state.state === "OPEN" ? this.getOpenStateReason() : undefined,
			state: this.state.state,
		};

		if (!result.allowed) {
			this.logger.warn("Operation rejected by circuit breaker", {
				operationId: operationId || "unknown",
				circuitState: this.state.state,
				failureCount: this.state.failureCount,
				failureThreshold: this.config.failureThreshold,
				timeUntilRecovery: Math.max(
					0,
					this.config.recoveryTimeout - (now - this.state.lastFailureTime)
				),
				operation: "shouldAllowOperation",
			});
		}

		return result;
	}

	/**
	 * ✅ ERROR_LOGGER: Record successful operation with proper logging
	 */
	public recordSuccess(operationId?: string): void {
		this.metrics.totalOperations++;
		this.metrics.totalSuccesses++;

		if (this.state.state === "HALF_OPEN") {
			this.state.consecutiveSuccesses++;

			if (this.state.consecutiveSuccesses >= this.config.recoveryThreshold) {
				this.closeCircuit(operationId);
			} else {
				this.logger.debug("Circuit breaker recovery in progress", {
					operationId: operationId || "unknown",
					consecutiveSuccesses: this.state.consecutiveSuccesses,
					recoveryThreshold: this.config.recoveryThreshold,
					operation: "recordSuccess",
				});
			}
		}
	}

	/**
	 * ✅ ERROR_LOGGER: Record failure with proper error classification
	 */
	public recordFailure(error: unknown, operationId?: string): void {
		this.metrics.totalOperations++;
		this.metrics.totalFailures++;
		this.state.failureCount++;
		this.state.lastFailureTime = Date.now();
		this.state.consecutiveSuccesses = 0; // Reset on any failure

		// Classify error type for better circuit breaker decisions
		const errorClassification = this.classifyError(error);

		this.logger.error("Circuit breaker recorded failure", error as Error, {
			operationId: operationId || "unknown",
			failureCount: this.state.failureCount,
			failureThreshold: this.config.failureThreshold,
			circuitState: this.state.state,
			errorClassification,
			operation: "recordFailure",
		});

		// Open circuit if threshold exceeded
		if (
			this.state.failureCount >= this.config.failureThreshold &&
			this.state.state === "CLOSED"
		) {
			this.openCircuit(operationId);
		}
	}

	/**
	 * ✅ GRACEFUL_DEGRADATION: Execute operation with circuit breaker protection
	 */
	public async execute<T>(
		operation: () => Promise<T>,
		operationId?: string,
		fallback?: () => Promise<T>
	): Promise<T> {
		const shouldAllow = await this.shouldAllowOperation(operationId);

		if (!shouldAllow.allowed) {
			if (fallback) {
				this.logger.info("Circuit breaker open, executing fallback", {
					operationId: operationId || "unknown",
					circuitState: shouldAllow.state,
					operation: "executeWithFallback",
				});
				return fallback();
			} else {
				throw new AppError(
					`Circuit breaker is open: ${shouldAllow.reason}`,
					503 // Service Unavailable
				);
			}
		}

		try {
			const result: T = await operation();
			this.recordSuccess(operationId);
			return result;
		} catch (error: unknown) {
			this.recordFailure(error, operationId);
			throw error;
		}
	}

	/**
	 * ✅ TYPED: Get current metrics for monitoring
	 */
	public getMetrics(): CircuitBreakerMetrics {
		const uptime = Date.now() - this.metrics.startTime;
		const uptimePercentage =
			this.metrics.totalOperations > 0
				? (this.metrics.totalSuccesses / this.metrics.totalOperations) * 100
				: 100;

		return {
			serviceName: this.config.serviceName,
			state: this.state.state,
			failureCount: this.state.failureCount,
			successCount: this.metrics.totalSuccesses,
			lastFailureTime: this.state.lastFailureTime,
			consecutiveSuccesses: this.state.consecutiveSuccesses,
			uptimePercentage: Math.round(uptimePercentage * 100) / 100,
			totalOperations: this.metrics.totalOperations,
			uptimeMs: uptime,
			uptimeDuration: this.formatUptime(uptime),
		};
	}

	/**
	 * ✅ GRACEFUL_DEGRADATION: Force circuit state for testing/recovery
	 */
	public forceState(
		newState: "CLOSED" | "OPEN" | "HALF_OPEN",
		reason?: string
	): void {
		const oldState = this.state.state;
		this.state.state = newState;

		if (newState === "CLOSED") {
			this.state.failureCount = 0;
			this.state.consecutiveSuccesses = 0;
		}

		this.logger.info("Circuit breaker state forced", {
			oldState,
			newState,
			reason: reason || "manual_override",
			operation: "forceState",
		});
	}

	// ✅ PRIVATE METHODS: Internal state management
	private async updateStateBasedOnTime(now: number): Promise<void> {
		if (
			this.state.state === "OPEN" &&
			now - this.state.lastFailureTime > this.config.recoveryTimeout
		) {
			this.state.state = "HALF_OPEN";
			this.state.consecutiveSuccesses = 0;

			this.logger.info("Circuit breaker transitioning to HALF_OPEN", {
				previousState: "OPEN",
				timeSinceLastFailure: now - this.state.lastFailureTime,
				recoveryTimeout: this.config.recoveryTimeout,
				operation: "stateTransition",
			});
		}
	}

	private async runHealthCheckIfNeeded(now: number): Promise<void> {
		if (now - this.state.lastHealthCheck > this.config.healthCheckInterval) {
			try {
				const isHealthy = await this.config.customHealthCheck();
				this.state.lastHealthCheck = now;

				if (isHealthy && this.state.state === "OPEN") {
					this.logger.info(
						"Health check passed while circuit open, transitioning to HALF_OPEN",
						{
							operation: "healthCheckRecovery",
						}
					);
					this.state.state = "HALF_OPEN";
					this.state.consecutiveSuccesses = 0;
				}
			} catch (error: unknown) {
				this.logger.debug("Health check failed", {
					error: error instanceof Error ? error.message : String(error),
					operation: "healthCheck",
				});
			}
		}
	}

	private closeCircuit(operationId?: string): void {
		this.state.state = "CLOSED";
		this.state.failureCount = 0;
		this.state.consecutiveSuccesses = 0;

		this.logger.info("Circuit breaker closed after successful recovery", {
			operationId: operationId || "unknown",
			recoveryThreshold: this.config.recoveryThreshold,
			operation: "circuitClosed",
		});
	}

	private openCircuit(operationId?: string): void {
		this.state.state = "OPEN";

		this.logger.error(
			"Circuit breaker opened due to excessive failures",
			new Error("Circuit breaker threshold exceeded"),
			{
				operationId: operationId || "unknown",
				failureCount: this.state.failureCount,
				failureThreshold: this.config.failureThreshold,
				recoveryTimeoutMs: this.config.recoveryTimeout,
				operation: "circuitOpened",
			}
		);
	}

	private getOpenStateReason(): string {
		const timeSinceFailure = Date.now() - this.state.lastFailureTime;
		const timeUntilRecovery = Math.max(
			0,
			this.config.recoveryTimeout - timeSinceFailure
		);

		return `Circuit breaker is open due to ${
			this.state.failureCount
		} failures. Recovery in ${Math.ceil(timeUntilRecovery / 1000)}s`;
	}

	private classifyError(error: unknown): ErrorClassification {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();
			return {
				type: error.constructor.name,
				isDatabaseError:
					message.includes("pool") ||
					message.includes("database") ||
					message.includes("connection"),
				isTimeoutError:
					message.includes("timeout") || message.includes("timed out"),
				isNetworkError:
					message.includes("network") || message.includes("econnreset"),
				isAppError: error.constructor.name === "AppError",
			};
		}

		return {
			type: typeof error,
			isDatabaseError: false,
			isTimeoutError: false,
			isNetworkError: false,
			isAppError: false,
		};
	}

	private formatUptime(uptimeMs: number): string {
		const seconds = Math.floor(uptimeMs / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h ${minutes % 60}m`;
		} else if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		} else if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		} else {
			return `${seconds}s`;
		}
	}
}

// ✅ TYPED: Define interface for error classification
interface ErrorClassification {
	type: string;
	isDatabaseError: boolean;
	isTimeoutError: boolean;
	isNetworkError: boolean;
	isAppError: boolean;
}
