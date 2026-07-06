// src/utils/langchain-logger.ts
import { Logger } from "./logger.js";

export enum LangChainErrorType {
	RATE_LIMIT = "RATE_LIMIT",
	AUTHENTICATION = "AUTHENTICATION",
	MODEL_UNAVAILABLE = "MODEL_UNAVAILABLE",
	INVALID_REQUEST = "INVALID_REQUEST",
	NETWORK_ERROR = "NETWORK_ERROR",
	PARSING_ERROR = "PARSING_ERROR",
	QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
	TIMEOUT = "TIMEOUT",
	UNKNOWN = "UNKNOWN",
}

interface LangChainLogContext {
	operation: string;
	service: string;
	model?: string;
	errorType?: LangChainErrorType;
	retryable?: boolean;
	queryLength?: number;
	productCount?: number;
	responseLength?: number;
	[key: string]: unknown;
}

/**
 * LangChain-specific Logger that wraps the base Logger
 * Provides structured logging with LangChain-specific context
 */
export class LangChainLogger {
	private baseLogger: Logger;

	constructor(config?: {
		serviceName?: string;
		level?: "debug" | "info" | "warn" | "error";
		silent?: boolean;
	}) {
		// ✅ Create base logger with sensible defaults
		this.baseLogger = new Logger({
			serviceName: config?.serviceName || "langchain-service",
			level: config?.level || "info",
			silent: config?.silent || false,
		});
	}

	/**
	 * Create LangChainLogger from existing Logger instance
	 */
	static fromLogger(baseLogger: Logger): LangChainLogger {
		const instance = new LangChainLogger();
		instance.baseLogger = baseLogger;
		return instance;
	}

	/**
	 * Log LangChain operation start
	 */
	public logOperationStart(
		operation: string,
		context: LangChainLogContext
	): void {
		this.baseLogger.info(`LangChain operation started: ${operation}`, {
			...context,
			phase: "start",
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log LangChain operation success
	 */
	public logOperationSuccess(
		operation: string,
		context: LangChainLogContext
	): void {
		this.baseLogger.info(`LangChain operation completed: ${operation}`, {
			...context,
			phase: "success",
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log LangChain operation warning (with fallback)
	 */
	public logOperationWarning(
		operation: string,
		reason: string,
		context: LangChainLogContext
	): void {
		this.baseLogger.warn(
			`LangChain operation warning: ${operation} - ${reason}`,
			{
				...context,
				phase: "warning",
				reason,
				timestamp: new Date().toISOString(),
			}
		);
	}

	/**
	 * Log LangChain error with enhanced context
	 */
	public logLangChainError(
		operation: string,
		errorMessage: string,
		context: LangChainLogContext & {
			errorType: LangChainErrorType;
			originalError?: unknown;
		}
	): void {
		// Extract error details if original error is provided
		let errorDetails: Record<string, unknown> = {};
		if (context.originalError) {
			if (context.originalError instanceof Error) {
				errorDetails = {
					originalErrorName: context.originalError.name,
					originalErrorMessage: context.originalError.message,
					originalErrorStack: context.originalError.stack?.split("\n")[0],
				};
			} else {
				errorDetails = {
					originalError: String(context.originalError),
				};
			}
		}

		// Use the base logger's error method correctly
		this.baseLogger.error(
			`LangChain operation failed: ${operation} - ${errorMessage}`,
			context.originalError instanceof Error
				? context.originalError
				: undefined,
			{
				...context,
				...errorDetails,
				phase: "error",
				timestamp: new Date().toISOString(),
				category: this.categorizeError(context.errorType),
			}
		);
	}

	/**
	 * Log retry attempt
	 */
	public logRetryAttempt(
		operation: string,
		attempt: number,
		maxAttempts: number,
		context: LangChainLogContext
	): void {
		this.baseLogger.warn(
			`LangChain retry attempt ${attempt}/${maxAttempts}: ${operation}`,
			{
				...context,
				phase: "retry",
				attempt,
				maxAttempts,
				timestamp: new Date().toISOString(),
			}
		);
	}

	/**
	 * Log fallback usage
	 */
	public logFallbackUsed(
		operation: string,
		reason: string,
		context: LangChainLogContext
	): void {
		this.baseLogger.info(`LangChain fallback used: ${operation} - ${reason}`, {
			...context,
			phase: "fallback",
			reason,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Log performance metrics
	 */
	public logPerformanceMetrics(
		operation: string,
		duration: number,
		context: LangChainLogContext
	): void {
		this.baseLogger.info(`LangChain performance: ${operation}`, {
			...context,
			phase: "metrics",
			duration,
			durationMs: `${duration}ms`,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Expose base logger methods for general logging
	 */
	public info(message: string, metadata?: Record<string, unknown>): void {
		this.baseLogger.info(message, metadata);
	}

	public warn(message: string, metadata?: Record<string, unknown>): void {
		this.baseLogger.warn(message, metadata);
	}

	public error(
		message: string,
		error?: Error,
		metadata?: Record<string, unknown>
	): void {
		this.baseLogger.error(message, error, metadata);
	}

	public debug(message: string, metadata?: Record<string, unknown>): void {
		this.baseLogger.debug(message, metadata);
	}

	/**
	 * Categorize errors for monitoring/alerting
	 */
	private categorizeError(errorType: LangChainErrorType): string {
		switch (errorType) {
			case LangChainErrorType.AUTHENTICATION:
			case LangChainErrorType.QUOTA_EXCEEDED:
				return "critical";

			case LangChainErrorType.RATE_LIMIT:
			case LangChainErrorType.MODEL_UNAVAILABLE:
			case LangChainErrorType.NETWORK_ERROR:
				return "warning";

			case LangChainErrorType.PARSING_ERROR:
			case LangChainErrorType.TIMEOUT:
				return "recoverable";

			case LangChainErrorType.INVALID_REQUEST:
				return "user_error";

			default:
				return "unknown";
		}
	}
}
