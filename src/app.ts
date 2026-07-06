// src/app.ts (or your main server file)

// ✅ CRITICAL: Import reflect-metadata FIRST, before anything else
import "reflect-metadata";

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io"; // ✅ Import socket.io

import { errorHandler } from "./middleware/errorHandler.js";
import { createDbPool } from "./config/database.aws.js";
import { initializeDrizzle } from "./db/index.js";
import apiRoutes from "./routes/index.js";
import { initializeWebSocketHandler } from "./websockets/chat.handler.js"; // ✅ Add this missing import
import { swaggerUi, swaggerSpec } from "./config/swagger.js";

// Load environment variables
dotenv.config();

const app: Application = express();
const server = http.createServer(app);

// Parse CORS_ORIGIN env as a comma-separated allowlist. Browsers reject the
// wildcard "*" when a request has credentials:"include", so we must echo the
// exact incoming origin and set Access-Control-Allow-Credentials: true.
const allowedOrigins = (process.env.CORS_ORIGIN || "*")
	.split(",")
	.map((o) => o.trim())
	.filter(Boolean);

const corsOriginCheck = (
	origin: string | undefined,
	callback: (err: Error | null, allow?: boolean | string) => void
) => {
	// Non-browser callers (curl, server-to-server) have no Origin header.
	if (!origin) return callback(null, true);
	if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
		return callback(null, true);
	}
	return callback(new Error(`CORS: origin ${origin} not allowed`));
};

const corsOptions = {
	origin: corsOriginCheck,
	credentials: true,
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

// ✅ Initialize socket.io with CORS configuration
const io = new SocketIOServer(server, {
	cors: {
		origin: allowedOrigins.includes("*") ? true : allowedOrigins,
		methods: ["GET", "POST"],
		credentials: true,
	},
});

const port = process.env.PORT || 3000;

// Middleware
// CSP disabled: this app serves JSON, not HTML, so a strict default-src
// would only complicate Socket.IO/Gemini origins without a real benefit.
// Frontend (Next.js) sets its own CSP via next.config headers.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add Swagger UI route
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.get("/", (req: Request, res: Response) => {
	res.json({ message: "Express + TypeScript Server" });
});

// API routes
app.use("/api", apiRoutes);

// ✅ Pass the `io` instance to the handler
initializeWebSocketHandler(io);

// Error handling middleware (should be last)
app.use(errorHandler);

/**
 * Encapsulates the application's startup logic.
 * It ensures the database is connected before the server starts accepting requests.
 */
async function startServer() {
	try {
		// 1. Create the database pool. This will throw an error if it fails.
		console.log("Connecting to the database...");
		const pool = await createDbPool();
		console.log("✅ Database pool created.");

		// 2. Initialize Drizzle with the connected pool.
		initializeDrizzle(pool);

		// 3. Start the Express server only after the database is ready.
		server.listen(port, () => {
			console.log(`🚀 Server is running at http://localhost:${port}`);
			console.log("✅ Socket.IO server initialized and listening.");
		});
	} catch (error) {
		console.error(
			"❌ Fatal: Failed to start server due to database connection error.",
			error
		);
		process.exit(1); // Exit with a failure code
	}
}

// Start the application
startServer();
