// src/config/database.ts (RECTIFIED)

import pkg from "pg";
import type { PoolConfig } from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";
import { Connector, AuthTypes } from "@google-cloud/cloud-sql-connector";
import { SecretsManager } from "./secrets.js";

dotenv.config();

// Define the Pool type from 'pg'
type DatabasePool = pkg.Pool;

/**
 * Creates and configures the database connection pool.
 * This function should be called ONCE when the application starts.
 */
export const createDbPool = async (): Promise<DatabasePool> => {
	console.log("Initializing database connection pool...");

	const isProd = process.env.NODE_ENV === "production";
	const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME;
	const isAws = Boolean(process.env.DB_HOST);

	// Support both GCP Cloud SQL (via INSTANCE_CONNECTION_NAME) and AWS/RDS (via DB_HOST/PORT)
	if (!instanceConnectionName && !isAws) {
		throw new Error(
			"Database configuration missing. Set INSTANCE_CONNECTION_NAME (GCP) or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD (AWS)."
		);
	}

	// 1. Credentials
	let user = "";
	let password = "";
	if (isAws) {
		// AWS/RDS path: use env directly and skip GCP Secret Manager entirely
		user = (process.env.DB_USER || "").trim();
		password = (process.env.DB_PASSWORD || "").trim();
		console.log("Using AWS/RDS credentials from environment variables.");
	} else {
		// GCP path: try Secret Manager, fallback to env
		try {
			const secretsManager = SecretsManager.getInstance();
			const credentials = await secretsManager.getDatabaseCredentials();
			user = credentials.user.trim();
			password = credentials.password.trim();
			console.log(
				"Successfully retrieved database credentials from Secret Manager."
			);
		} catch (error) {
			console.warn(
				"Could not get credentials from Secret Manager. Falling back to env vars.",
				error
			);
			user = (process.env.DB_USER || "").trim();
			password = (process.env.DB_PASSWORD || "").trim();
		}
	}

	if (!user || !password) {
		throw new Error("Database user and password are required.");
	}

	let clientOpts: Partial<PoolConfig> = {};

	if (instanceConnectionName && !isAws) {
		// 2A. GCP Cloud SQL Connector path
		console.log("Setting up Cloud SQL connector (GCP)...");
		const connector = new Connector();
		clientOpts = await connector.getOptions({
			instanceConnectionName,
			authType: isProd ? AuthTypes.IAM : AuthTypes.PASSWORD,
		});
	} else {
		// 2B. AWS/RDS direct connection path
		console.log("Setting up direct PostgreSQL connection (AWS/RDS)...");
		clientOpts = {
			host: process.env.DB_HOST,
			port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
			// Default to SSL ON for AWS unless explicitly disabled
			ssl:
				process.env.DB_SSL === "false"
					? undefined
					: { rejectUnauthorized: false },
		};
	}

	// 3. Create the Pool Configuration
	const poolConfig: PoolConfig = {
		...clientOpts,
		user,
		password,
		database: process.env.DB_NAME || "",
		max: isProd ? 15 : 5, // Adjust pool size for different environments
		connectionTimeoutMillis: 30000, // 30 seconds
		// Evict idle clients well before typical server-side idle_session_timeout
		// values (often ~30s on managed Postgres / AWS RDS / session poolers).
		// Racing the server produces a 57P05 FATAL in logs and an occasional
		// rejected query.
		idleTimeoutMillis: 10000, // 10 seconds
		// Add application_name to identify connections in pg_stat_activity
		application_name: `converge-app-${process.env.NODE_ENV || "development"}`,
	};

	// 4. Create and Test the Pool
	try {
		const pool = new Pool(poolConfig);

		// Pool error listener — required, otherwise an unhandled error on an
		// idle client crashes the process. Benign "server evicted idle
		// connection" (57P05) is downgraded to a warn so real issues stand out.
		pool.on("error", (err: Error & { code?: string }) => {
			if (err.code === "57P05") {
				console.warn(
					"PostgreSQL server evicted idle pool client (expected; pool will replace it)"
				);
				return;
			}
			console.error("Unexpected error on idle PostgreSQL client", err);
		});

		console.log("Testing database connection...");
		const client = await pool.connect();
		const result = await client.query("SELECT NOW()");
		console.log("✅ Database connected successfully:", result.rows[0]);
		client.release();

		console.log("✅ Database pool initialization complete.");
		return pool;
	} catch (error) {
		console.error("❌ Database pool initialization failed:", error);
		throw error; // This will crash the app, which is the desired behavior
	}
};
