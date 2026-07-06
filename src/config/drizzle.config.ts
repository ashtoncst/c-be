// drizzle.config.ts (RECTIFIED)

import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * Builds the correct database connection URL based on the environment.
 * This is crucial for Drizzle Kit to connect correctly for migrations.
 */
function getDatabaseUrl(): string {
	const isProduction = process.env.NODE_ENV === "production";
	const dbUser = process.env.DB_USER;
	const dbPassword = process.env.DB_PASSWORD;
	const dbName = process.env.DB_NAME;
	const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;

	if (!dbUser || !dbPassword || !dbName) {
		throw new Error("Missing required database credentials.");
	}

	// For production on Cloud Run, connect via a secure Unix socket.
	// This is faster and doesn't require exposing a public IP.
	if (isProduction) {
		if (!instanceConnectionName) {
			throw new Error("INSTANCE_CONNECTION_NAME is required for production.");
		}
		return `postgresql://${dbUser}:${dbPassword}@localhost/${dbName}?host=/cloudsql/${instanceConnectionName}`;
	}

	// For local development, connect to the Cloud SQL Auth Proxy via TCP.
	return `postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}`;
}

export default defineConfig({
	schema: "./src/models/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		// Use `connectionString` to pass the full URL, which correctly handles the Unix socket path.
		url: getDatabaseUrl(),
	},
	verbose: true,
	strict: true,
});
