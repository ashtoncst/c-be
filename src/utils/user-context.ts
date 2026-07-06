import { db } from "../db/index.js"; // ✅ Import Drizzle instance
import { sql } from "drizzle-orm"; // ✅ Import sql for raw queries
import { Logger } from "./logger.js";

export class UserContext {
	private static logger = new Logger({ serviceName: "UserContext" });

	/**
	 * Set the current user ID in the PostgreSQL session for activity logging.
	 * NOTE: This is an advanced feature. Ensure your DB user has permissions.
	 */
	static async setCurrentUser(userId: string): Promise<void> {
		const query = sql`SELECT set_config('app.current_user_id', ${userId}, false)`;

		this.logger.debug("Setting user context for database session", { userId });

		try {
			await db.execute(query);
			this.logger.debug("User context set successfully", { userId });
		} catch (error: unknown) {
			this.logger.error("Failed to set user context", error as Error, {
				userId,
			});
			// We don't re-throw here as this is often a non-critical operation
		}
	}

	/**
	 * Clear the current user context.
	 */
	static async clearCurrentUser(): Promise<void> {
		const query = sql`SELECT set_config('app.current_user_id', '', false)`;

		this.logger.debug("Clearing user context from database session");

		try {
			await db.execute(query);
			this.logger.debug("User context cleared successfully");
		} catch (error: unknown) {
			this.logger.error("Failed to clear user context", error as Error);
		}
	}
}
