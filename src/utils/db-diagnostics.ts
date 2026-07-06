/**
 * Database Diagnostics Utility
 *
 * Provides a simple function to check the database connection health.
 */

import { db } from "../db/index.js";
import { sql } from "drizzle-orm";
import { Logger } from "./logger.js";

const logger = new Logger({ serviceName: "db-diagnostics" });

/**
 * Performs a simple query to validate that the database is connected and responsive.
 * This is intended for use in health check endpoints.
 * @returns {Promise<boolean>} - True if the connection is healthy, false otherwise.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		// Drizzle's `db.execute` will use a connection from the pool.
		// If it fails, it will throw an error, indicating a problem.
		await db.execute(sql`SELECT 1`);
		logger.debug("Database connection check successful.");
		return true;
	} catch (error) {
		logger.error("Database connection check failed.", error as Error);
		return false;
	}
}

