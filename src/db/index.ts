// src/db/index.ts (RECTIFIED)

import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../models/schema.model.js";
import { Logger } from "../utils/logger.js";

// Use 'let' to allow the db instance to be initialized later.
// The type helps ensure it's used correctly after initialization.
export let db: NodePgDatabase<typeof schema>;

/**
 * Initializes the Drizzle ORM instance with a connected database pool.
 * This must be called at application startup.
 * @param pool The connected 'pg' Pool instance.
 */
export const initializeDrizzle = (pool: Pool) => {
	const logger = new Logger({ serviceName: "Database" });
	logger.info("Initializing Drizzle ORM...");
	db = drizzle(pool, { schema, logger: process.env.NODE_ENV !== "production" });
	logger.info("Drizzle ORM initialized successfully");
	return db;
};
