/**
 * Logger Configuration
 *
 * A simple, human-readable console logger for development
 */

interface LoggerConfig {
	serviceName: string;
	level?: "debug" | "info" | "warn" | "error";
	silent?: boolean;
}

/**
 * Custom console logger with human-readable formatting
 */
export class Logger {
	private readonly serviceName: string;
	private readonly level: string;
	private readonly silent: boolean;
	private readonly levelPriority: Record<string, number> = {
		debug: 0,
		info: 1,
		warn: 2,
		error: 3,
	};

	constructor(config: LoggerConfig) {
		this.serviceName = config.serviceName;
		this.level = config.level || "info";
		this.silent = config.silent || false;
	}

	// ✅ Add getters to expose configuration
	public get config(): Readonly<LoggerConfig> {
		return {
			serviceName: this.serviceName,
			level: this.level as "debug" | "info" | "warn" | "error",
			silent: this.silent,
		};
	}

	// Or individual getters
	public getServiceName(): string {
		return this.serviceName;
	}

	public getLevel(): "debug" | "info" | "warn" | "error" {
		return this.level as "debug" | "info" | "warn" | "error";
	}

	public getSilent(): boolean {
		return this.silent;
	}

	/**
	 * Format a log message with timestamp, level, and service
	 */
	private formatLogMessage(
		level: string,
		message: string,
		metadata?: Record<string, unknown>
	): string {
		const timestamp = new Date().toLocaleTimeString();
		const levelPadded = level.toUpperCase().padEnd(5, " ");

		let formattedMessage = `[${timestamp}] [${levelPadded}] [${this.serviceName}] ${message}`;

		if (metadata && Object.keys(metadata).length > 0) {
			// Error-diagnostic fields get full width so we can see HTTP status
			// codes and stack frames. Other long string fields still truncate
			// to keep non-error logs compact.
			const DIAGNOSTIC_KEYS = new Set([
				"errorMessage",
				"stack",
				"stackTrace",
				"error",
				"reason",
				"url",
			]);
			const maxLen = (key: string) =>
				DIAGNOSTIC_KEYS.has(key) ? 2000 : 100;

			const metadataString = Object.entries(metadata)
				.map(([key, value]) => {
					const limit = maxLen(key);
					if (typeof value === "object" && value !== null) {
						if (Array.isArray(value)) {
							return `${key}: Array(${value.length})`;
						}
						const serialized = JSON.stringify(value);
						return `${key}: ${serialized.substring(0, limit)}${
							serialized.length > limit ? "..." : ""
						}`;
					} else if (typeof value === "string" && value.length > limit) {
						return `${key}: "${value.substring(0, limit)}..."`;
					}
					return `${key}: ${value}`;
				})
				.join(", ");

			formattedMessage += ` (${metadataString})`;
		}

		return formattedMessage;
	}

	/**
	 * Log a message if level priority meets threshold
	 */
	private log(
		level: string,
		message: string,
		metadata?: Record<string, unknown>
	): void {
		if (
			this.silent ||
			this.levelPriority[level] < this.levelPriority[this.level]
		) {
			return;
		}

		const formattedMessage = this.formatLogMessage(level, message, metadata);

		switch (level) {
			case "error":
				console.error(formattedMessage);
				break;
			case "warn":
				console.warn(formattedMessage);
				break;
			default:
				console.log(formattedMessage);
		}
	}

	/**
	 * Log a debug message
	 */
	public debug(message: string, metadata?: Record<string, unknown>): void {
		this.log("debug", message, metadata);
	}

	/**
	 * Log an info message
	 */
	public info(message: string, metadata?: Record<string, unknown>): void {
		this.log("info", message, metadata);
	}

	/**
	 * Log a warning message
	 */
	public warn(message: string, metadata?: Record<string, unknown>): void {
		this.log("warn", message, metadata);
	}

	/**
	 * Log an error message with optional error object
	 */
	public error(
		message: string,
		error?: Error,
		metadata?: Record<string, unknown>
	): void {
		const errorMeta = error
			? {
					errorName: error.name,
					errorMessage: error.message,
					stack: error.stack?.split("\n")[0], // Just first line of stack for readability
					...metadata,
			  }
			: metadata;

		this.log("error", message, errorMeta);
	}
}
