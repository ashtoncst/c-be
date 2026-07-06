import { Request, Response, NextFunction } from "express";

// Define custom error types
export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;
	public readonly details?: Record<string, unknown>;

	constructor(
		message: string,
		statusCode: number,
		options: {
			isOperational?: boolean;
			details?: Record<string, unknown>;
			cause?: unknown;
		} = {}
	) {
		super(message);
		this.statusCode = statusCode;
		this.isOperational = options.isOperational ?? true;
		this.details = options.details;

		if (options.cause && options.cause instanceof Error) {
			this.cause = options.cause;
		}

		Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain
		Error.captureStackTrace(this, this.constructor);
	}
}

// Database error
export class DatabaseError extends AppError {
	constructor(
		message: string,
		options: { cause?: unknown; details?: Record<string, unknown> } = {}
	) {
		super(message, 500, {
			cause: options.cause,
			details: options.details,
		});
		this.name = "DatabaseError";
	}
}

// Validation error
export class ValidationError extends AppError {
	constructor(message: string, public errors: Record<string, string>) {
		super(message, 400);
		this.name = "ValidationError";
	}
}

// Auth error
export class AuthError extends AppError {
	constructor(message: string) {
		super(message, 401);
		this.name = "AuthError";
	}
}

// Not found error
export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message, 404);
		this.name = "NotFoundError";
	}
}

// Custom error handler middleware
export const errorHandler = (
	err: Error | AppError,
	req: Request,
	res: Response,
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	next: NextFunction
): Response => {
	// Log error details for debugging
	console.error(`[ERROR] ${new Date().toISOString()}:`, {
		type: err.name,
		path: req.path,
		method: req.method,
		message: err.message,
		stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
	});

	// Handle known operational errors
	if (err instanceof AppError) {
		const errorResponse = {
			success: false,
			error: {
				message: err.message,
				type: err.name,
			},
		};

		// Add validation errors if available
		if (err instanceof ValidationError) {
			Object.assign(errorResponse.error, { validationErrors: err.errors });
		}

		// Use the statusCode from the AppError
		return res.status(err.statusCode).json(errorResponse);
	}

	// Handle Sequelize/TypeORM validation errors (can be customized based on your ORM)
	if (
		err.name === "SequelizeValidationError" ||
		err.name === "SequelizeUniqueConstraintError"
	) {
		return res.status(400).json({
			success: false,
			error: {
				message: "Validation error",
				type: "ValidationError",
				details: err.message,
			},
		});
	}

	// Handle SyntaxError (like JSON parsing errors)
	if (err instanceof SyntaxError && "body" in err) {
		return res.status(400).json({
			success: false,
			error: {
				message: "Invalid JSON",
				type: "SyntaxError",
			},
		});
	}

	// For unhandled errors, send generic response in production
	// but include stack trace in development
	const errorResponse = {
		success: false,
		error: {
			message:
				process.env.NODE_ENV === "production"
					? "Internal server error"
					: err.message,
			type: "UnhandledError",
		},
	};

	if (process.env.NODE_ENV !== "production") {
		Object.assign(errorResponse.error, { stack: err.stack });
	}

	return res.status(500).json(errorResponse);
};
