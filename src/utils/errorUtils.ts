import { DatabaseError, NotFoundError } from "../middleware/errorHandler.js";
// import { db } from "../db/index.js"; // ✅ Use Drizzle db
import { Logger } from "./logger.js";
import { ValidationError } from "../middleware/errorHandler.js";
import { AppError } from "../middleware/errorHandler.js";

const logger = new Logger({ serviceName: "errorUtils" });

/**
 * Helper function to wrap Drizzle operations with standardized error handling.
 * Drizzle's API is already robust, so this is a lightweight wrapper.
 * @param operation - A function that performs the Drizzle database operation.
 * @param entityName - Name of the entity being operated on (e.g., 'document', 'user').
 * @param operationName - Name of the operation being performed (e.g., 'find', 'create').
 */
export async function executeDbOperation<T>(
	operation: () => Promise<T>,
	entityName: string,
	operationName: string
): Promise<T> {
	try {
		return await operation();
	} catch (error: unknown) {
		logger.error(
			`Database operation failed: ${operationName} ${entityName}`,
			error as Error
		);

		if (error instanceof NotFoundError) {
			throw error; // Re-throw NotFoundErrors as they are intentional
		}

		// ✅ ADD THIS: Allow ValidationError and other AppErrors to bubble up
		if (error instanceof ValidationError || error instanceof AppError) {
			throw error; // Re-throw business logic errors unchanged
		}

		if (isPostgresError(error)) {
			if (error.code === "23505") {
				// unique_violation
				throw new DatabaseError(
					`A ${entityName} with the provided details already exists.`,
					{ cause: error }
				);
			}
			if (error.code === "23503") {
				// foreign_key_violation
				throw new DatabaseError(`A related ${entityName} could not be found.`, {
					cause: error,
				});
			}
		}

		// For all other errors, throw a generic DatabaseError
		throw new DatabaseError(
			`An unexpected error occurred while trying to ${operationName} the ${entityName}.`,
			{ cause: error }
		);
	}
}

/**
 * Helper function to check if a result from a Drizzle query is null/undefined
 * and throw a standardized NotFoundError if it is.
 * @param result - The entity that was looked up.
 * @param entityName - Name of the entity type (e.g., 'document', 'user').
 * @param identifier - The identifier used to look up the entity.
 */
export function throwIfNotFound<T>(
	result: T | null | undefined,
	entityName: string,
	identifier: string | number
): T {
	if (result === null || result === undefined) {
		throw new NotFoundError(
			`${entityName} with identifier '${identifier}' not found.`
		);
	}
	return result;
}

export interface PostgresError extends Error {
	code?: string;
	constraint?: string;
}

export function isPostgresError(error: unknown): error is PostgresError {
	return (
		error instanceof Error && typeof (error as PostgresError).code === "string"
	);
}
