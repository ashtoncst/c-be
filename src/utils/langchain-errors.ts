// src/utils/langchain-errors.ts
import { AppError } from "../middleware/errorHandler.js";
import { LangChainLogger, LangChainErrorType } from "./langchain-logger.js";

// Define LangChain-specific error types
export class LangChainError extends AppError {
	constructor(
		message: string,
		statusCode: number,
		public readonly errorType: LangChainErrorType,
		options: {
			cause?: unknown;
			details?: Record<string, unknown>;
			retryable?: boolean;
		} = {}
	) {
		super(message, statusCode, {
			cause: options.cause,
			details: {
				...options.details,
				errorType,
				retryable: options.retryable ?? false,
			},
		});
		this.name = "LangChainError";
	}
}

// Export the enum from langchain-logger for convenience
export { LangChainErrorType } from "./langchain-logger.js";

// ✅ Fixed: Added index signature to satisfy Record<string, unknown>
interface LangChainErrorContext extends Record<string, unknown> {
	operation: string;
	service: string;
	model?: string;
	queryLength?: number;
	productCount?: number;
}

// ✅ Fixed: Better type for error objects
interface ErrorLike {
	message?: string;
	status?: number;
	code?: string;
	name?: string;
	response?: {
		status?: number;
	};
}

export class LangChainErrorHandler {
	private logger: LangChainLogger;

	constructor(logger?: LangChainLogger) {
		// ✅ Use provided logger or create new one
		this.logger =
			logger ||
			new LangChainLogger({
				serviceName: "langchain-error-handler",
				level: "info",
				silent: false,
			});
	}

	/**
	 * Handle LangChain/Google GenAI specific errors with proper classification
	 */
	public handleLangChainError(
		error: unknown,
		context: LangChainErrorContext
	): LangChainError {
		// Handle Google GenAI specific errors
		if (this.isGoogleGenAIError(error)) {
			return this.handleGoogleGenAIError(error as ErrorLike, context);
		}

		// Handle LangChain core errors
		if (this.isLangChainCoreError(error)) {
			return this.handleLangChainCoreError(error as ErrorLike, context);
		}

		// Handle network/timeout errors
		if (this.isNetworkError(error)) {
			return this.handleNetworkError(error as ErrorLike, context);
		}

		// Generic error handling
		return this.handleGenericError(error, context);
	}

	private isGoogleGenAIError(error: unknown): boolean {
		if (typeof error === "object" && error !== null) {
			const err = error as ErrorLike;
			// Check for Google API error patterns
			return !!(
				err.status ||
				err.code ||
				err.message?.includes("API key") ||
				err.message?.includes("quota") ||
				err.message?.includes("rate limit")
			);
		}
		return false;
	}

	private isLangChainCoreError(error: unknown): boolean {
		if (typeof error === "object" && error !== null) {
			const err = error as ErrorLike;
			return !!(
				err.name?.includes("LangChain") ||
				err.message?.includes("parsing") ||
				err.message?.includes("runnable")
			);
		}
		return false;
	}

	private isNetworkError(error: unknown): boolean {
		if (typeof error === "object" && error !== null) {
			const err = error as ErrorLike;
			return !!(
				err.code === "ECONNREFUSED" ||
				err.code === "ETIMEDOUT" ||
				err.code === "ENOTFOUND" ||
				err.message?.includes("timeout") ||
				err.message?.includes("network")
			);
		}
		return false;
	}

	// ✅ Fixed: Better error message extraction
	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		if (typeof error === "object" && error !== null) {
			const errorLike = error as ErrorLike;
			return errorLike.message || String(error);
		}
		return String(error);
	}

	private handleGoogleGenAIError(
		error: ErrorLike,
		context: LangChainErrorContext
	): LangChainError {
		const status = error.status || error.response?.status;
		const errorMessage = this.getErrorMessage(error);

		switch (status) {
			case 401:
				// ✅ Use enhanced logging
				this.logger.logLangChainError("authentication", errorMessage, {
					...context,
					errorType: LangChainErrorType.AUTHENTICATION,
					originalError: error,
				});
				return new LangChainError(
					"Google Gemini API authentication failed",
					401,
					LangChainErrorType.AUTHENTICATION,
					{
						cause: error,
						details: {
							...context,
							apiKeyConfigured: !!process.env.GOOGLE_GEMINI_API_KEY,
						},
					}
				);

			case 429:
				this.logger.logLangChainError("rate_limit", errorMessage, {
					...context,
					errorType: LangChainErrorType.RATE_LIMIT,
					retryable: true,
					originalError: error,
				});
				return new LangChainError(
					"Google Gemini API rate limit exceeded",
					429,
					LangChainErrorType.RATE_LIMIT,
					{
						cause: error,
						details: context,
						retryable: true,
					}
				);

			case 503:
				this.logger.logLangChainError("model_unavailable", errorMessage, {
					...context,
					errorType: LangChainErrorType.MODEL_UNAVAILABLE,
					originalError: error,
				});
				return new LangChainError(
					"Google Gemini model temporarily unavailable",
					503,
					LangChainErrorType.MODEL_UNAVAILABLE,
					{
						cause: error,
						details: context,
						retryable: true,
					}
				);

			default:
				if (errorMessage.includes("quota")) {
					this.logger.logLangChainError("quota_exceeded", errorMessage, {
						...context,
						errorType: LangChainErrorType.QUOTA_EXCEEDED,
						originalError: error,
					});
					return new LangChainError(
						"Google Gemini API quota exceeded",
						429,
						LangChainErrorType.QUOTA_EXCEEDED,
						{ cause: error, details: context }
					);
				}

				this.logger.logLangChainError("unknown_error", errorMessage, {
					...context,
					errorType: LangChainErrorType.UNKNOWN,
					originalError: error,
				});
				return new LangChainError(
					"Google Gemini API error",
					500,
					LangChainErrorType.UNKNOWN,
					{ cause: error, details: { ...context, status } }
				);
		}
	}

	private handleLangChainCoreError(
		error: ErrorLike,
		context: LangChainErrorContext
	): LangChainError {
		const errorMessage = this.getErrorMessage(error);

		if (errorMessage.includes("parsing")) {
			this.logger.logLangChainError("parsing_error", errorMessage, {
				...context,
				errorType: LangChainErrorType.PARSING_ERROR,
				originalError: error,
			});
			return new LangChainError(
				"Failed to parse LangChain response",
				422,
				LangChainErrorType.PARSING_ERROR,
				{
					cause: error,
					details: context,
					retryable: true,
				}
			);
		}

		this.logger.logLangChainError("core_error", errorMessage, {
			...context,
			errorType: LangChainErrorType.UNKNOWN,
			originalError: error,
		});
		return new LangChainError(
			"LangChain processing error",
			500,
			LangChainErrorType.UNKNOWN,
			{ cause: error, details: context }
		);
	}

	private handleNetworkError(
		error: ErrorLike,
		context: LangChainErrorContext
	): LangChainError {
		const errorMessage = this.getErrorMessage(error);

		this.logger.logLangChainError("network_error", errorMessage, {
			...context,
			errorType: LangChainErrorType.NETWORK_ERROR,
			originalError: error,
		});

		return new LangChainError(
			"Network error while communicating with AI service",
			503,
			LangChainErrorType.NETWORK_ERROR,
			{
				cause: error,
				details: { ...context, code: error.code },
				retryable: true,
			}
		);
	}

	private handleGenericError(
		error: unknown,
		context: LangChainErrorContext
	): LangChainError {
		const errorMessage = this.getErrorMessage(error);

		this.logger.logLangChainError("generic_error", errorMessage, {
			...context,
			errorType: LangChainErrorType.UNKNOWN,
			originalError: error,
		});

		return new LangChainError(
			"Unexpected error in AI processing",
			500,
			LangChainErrorType.UNKNOWN,
			{ cause: error, details: context }
		);
	}

	/**
	 * Determine if an error is retryable
	 */
	public isRetryable(error: LangChainError): boolean {
		return [
			LangChainErrorType.RATE_LIMIT,
			LangChainErrorType.MODEL_UNAVAILABLE,
			LangChainErrorType.NETWORK_ERROR,
			LangChainErrorType.TIMEOUT,
			LangChainErrorType.PARSING_ERROR,
		].includes(error.errorType);
	}
}
