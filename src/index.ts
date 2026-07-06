/**
 * Senate Backend Application Entry Point
 */

// ✅ CRITICAL: Import reflect-metadata FIRST, before anything else
import "reflect-metadata";

import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { Logger } from "./utils/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createDbPool } from "./config/database.js";
import { initializeDrizzle } from "./db/index.js";
import apiRoutes from "./routes/index.js";
import { initializeWebSocketHandler } from "./websockets/chat.handler.js";
import { extractClientIp } from "./utils/ip-extractor.js";

// Initialize logger
const logger = new Logger({
  serviceName: "converge-global-be",
  level: process.env.LOG_LEVEL as
    | "info"
    | "debug"
    | "warn"
    | "error"
    | undefined,
});

// Load environment variables
dotenv.config();

const app: Application = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true, // Enable compatibility with older clients
  // Increase ping settings to keep connections alive (especially important for mobile)
  pingTimeout: 60000, // 60 seconds - how long to wait for pong before closing (default 20000)
  pingInterval: 25000, // 25 seconds - how often to send ping (default 25000)
  // Allow more time for upgrades on slow mobile networks
  upgradeTimeout: 30000, // 30 seconds (default 10000)
});

// --- Connection limiter: max 5 WebSocket connections per IP ---
const MAX_CONNECTIONS_PER_IP = 5;
const ipConnectionCounts = new Map<string, number>();

io.use((socket, next) => {
  const ip = extractClientIp(socket);
  const current = ipConnectionCounts.get(ip) ?? 0;

  if (current >= MAX_CONNECTIONS_PER_IP) {
    logger.warn(`Connection limit exceeded for IP: ${ip}`);
    return next(new Error("Too many connections. Please try again later."));
  }

  ipConnectionCounts.set(ip, current + 1);

  socket.on("disconnect", () => {
    const count = ipConnectionCounts.get(ip) ?? 1;
    if (count <= 1) {
      ipConnectionCounts.delete(ip);
    } else {
      ipConnectionCounts.set(ip, count - 1);
    }
  });

  next();
});

// Periodic cleanup: reset stale IP counts every 5 minutes
// (handles ungraceful disconnects that skip the disconnect event)
setInterval(() => {
  if (ipConnectionCounts.size > 0) {
    logger.info(
      `Resetting ${ipConnectionCounts.size} IP connection counters`
    );
    ipConnectionCounts.clear();
  }
}, 5 * 60 * 1000);

// Log WebSocket configuration on startup
logger.info("🔌 Socket.IO Configuration:", {
  corsOrigin: process.env.CORS_ORIGIN || "*",
  transports: ["websocket", "polling"],
  allowEIO3: true,
  maxConnectionsPerIp: MAX_CONNECTIONS_PER_IP,
});

const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("user-agent") || "unknown",
  });
  next();
});

// API routes
app.use("/api", apiRoutes);

// Initialize WebSocket handler
initializeWebSocketHandler(io);

// Error handling middleware
app.use(errorHandler);

async function startServer() {
  try {
    logger.info("Initializing database connection pool...");
    const pool = await createDbPool();
    logger.info("Database connection pool initialized successfully.");

    initializeDrizzle(pool);
    logger.info("Drizzle ORM initialized.");

    server.listen(port, () => {
      logger.info(`🚀 Server is running at http://localhost:${port}`);
      logger.info("✅ Socket.IO server initialized and listening.");
    });
  } catch (error) {
    logger.error("❌ Fatal: Failed to start server.", error as Error);
    process.exit(1);
  }
}

async function gracefulShutdown(serverInstance: http.Server): Promise<void> {
  logger.info("Received shutdown signal, closing server...");
  serverInstance.close(() => {
    logger.info("HTTP server closed.");
    // Here you could also add logic to gracefully close the DB pool if needed
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

// Start the application
startServer();

process.on("SIGTERM", () => gracefulShutdown(server));
process.on("SIGINT", () => gracefulShutdown(server));
