// src/routes/index.ts
import { Router } from "express";
import chatRoutes from "./chat.routes.js";
import itemRoutes from "./item.routes.js";
import cartRoutes from "./cart.routes.js";
import emailRoutes from "./email.routes.js";

const router = Router();

// Mount API routes
router.use("/chat", chatRoutes);
router.use("/items", itemRoutes); // Unified item routes (solutions, categories, products)
router.use("/cart", cartRoutes);
router.use("/email", emailRoutes);

// Health check endpoint - could also be in a separate health.routes.ts
router.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		service: "converge-global-be",
	});
});

export default router;
