// src/config/database.aws.ts
// AWS RDS compatible database configuration (without Google Cloud SQL Connector)

import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

// Define the Pool type from 'pg'
type DatabasePool = pkg.Pool;

/**
 * Creates and configures the database connection pool for AWS RDS.
 * This is a simplified version without Google Cloud SQL Connector.
 */
export const createDbPool = async (): Promise<DatabasePool> => {
  console.log("Initializing AWS RDS database connection pool...");

  const isProd = process.env.NODE_ENV === "production";

  // Required environment variables
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT || "5432";
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;

  // Validation
  if (!dbHost || !dbName || !dbUser || !dbPassword) {
    const missing = [];
    if (!dbHost) missing.push("DB_HOST");
    if (!dbName) missing.push("DB_NAME");
    if (!dbUser) missing.push("DB_USER");
    if (!dbPassword) missing.push("DB_PASSWORD");
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  // Create the Pool Configuration
  const poolConfig = {
    host: dbHost,
    port: parseInt(dbPort, 10),
    database: dbName,
    user: dbUser,
    password: dbPassword,
    max: isProd ? 15 : 5, // Adjust pool size for different environments
    min: 2, // Minimum connections to keep alive
    connectionTimeoutMillis: 30000, // 30 seconds
    // Evict idle clients well before typical server-side idle_session_timeout
    // values (often ~30s on managed Postgres / AWS RDS / session poolers).
    // Racing the server produces a 57P05 FATAL in logs and an occasional
    // rejected query.
    idleTimeoutMillis: 10000, // 10 seconds
    // Add application_name to identify connections in pg_stat_activity
    application_name: `converge-app-${process.env.NODE_ENV || "development"}`,
    // SSL configuration for AWS RDS (required by default)
    ssl: {
      rejectUnauthorized: false, // RDS uses self-signed certs
    },
  };

  // Create and Test the Pool
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

    // Log connection attempt
    console.log(`Connecting to PostgreSQL at ${dbHost}:${dbPort}/${dbName}...`);

    // Test the connection
    const client = await pool.connect();
    const result = await client.query("SELECT NOW(), version() as pg_version");
    console.log("✅ Database connected successfully:");
    console.log(`   Time: ${result.rows[0].now}`);
    console.log(`   PostgreSQL: ${result.rows[0].pg_version.split(" ")[1]}`);
    client.release();

    console.log("✅ Database pool initialization complete.");
    console.log(`   Pool size: min=${poolConfig.min}, max=${poolConfig.max}`);

    return pool;
  } catch (error) {
    console.error("❌ Database pool initialization failed:");
    console.error(`   Host: ${dbHost}:${dbPort}`);
    console.error(`   Database: ${dbName}`);
    console.error(`   User: ${dbUser}`);
    console.error(`   Error: ${error}`);
    throw error; // This will crash the app, which is the desired behavior
  }
};
