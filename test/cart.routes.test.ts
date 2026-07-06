// test/cart.routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { Request, Response } from "express";

// Create mock controller before any imports
const mockCartController = {
	generateSession: vi.fn(),
	getSessionInfo: vi.fn(),
	addToCart: vi.fn(),
	removeFromCart: vi.fn(),
	getCartContents: vi.fn(),
	clearCart: vi.fn(),
	getCartItemCount: vi.fn(),
	convertToSalesLead: vi.fn(),
};

// Mock the controller module
vi.mock("../src/controllers/cart.controller.js", () => ({
	default: mockCartController,
}));

// Import routes after mocking
const { default: cartRoutes } = await import("../src/routes/cart.routes.js");

describe("Cart Routes", () => {
	let app: express.Application;

	beforeEach(() => {
		vi.clearAllMocks();
		app = express();
		app.use(express.json());
		app.use("/api/cart", cartRoutes);
	});

	describe("POST /api/cart/session", () => {
		it("should call generateSession controller", async () => {
			const mockSessionData = {
				sessionId: "session-12345",
				itemCount: 0,
				createdAt: new Date().toISOString(),
			};

			mockCartController.generateSession.mockImplementation(
				(req: Request, res: Response) => {
					res.status(201).json({
						success: true,
						data: mockSessionData,
					});
				}
			);

			const response = await request(app).post("/api/cart/session");

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				success: true,
				data: mockSessionData,
			});
			expect(mockCartController.generateSession).toHaveBeenCalled();
		});

		it("should handle controller errors", async () => {
			mockCartController.generateSession.mockImplementation(
				(req: Request, res: Response) => {
					res.status(500).json({
						success: false,
						error: "Internal server error",
					});
				}
			);

			const response = await request(app).post("/api/cart/session");

			expect(response.status).toBe(500);
			expect(mockCartController.generateSession).toHaveBeenCalled();
		});
	});

	describe("GET /api/cart/session/:sessionId", () => {
		it("should call getSessionInfo controller with correct sessionId", async () => {
			const sessionId = "session-123";
			const mockSessionInfo = {
				sessionId,
				itemCount: 3,
				createdAt: new Date().toISOString(),
			};

			mockCartController.getSessionInfo.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.params.sessionId).toBe(sessionId);
					res.status(200).json({
						success: true,
						data: mockSessionInfo,
					});
				}
			);

			const response = await request(app).get(`/api/cart/session/${sessionId}`);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				success: true,
				data: mockSessionInfo,
			});
			expect(mockCartController.getSessionInfo).toHaveBeenCalled();
		});

		it("should handle controller errors", async () => {
			const sessionId = "invalid-session";

			mockCartController.getSessionInfo.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Session ID is required",
					});
				}
			);

			const response = await request(app).get(`/api/cart/session/${sessionId}`);

			expect(response.status).toBe(400);
			expect(mockCartController.getSessionInfo).toHaveBeenCalled();
		});
	});

	describe("POST /api/cart/add", () => {
		it("should call addToCart controller with request body", async () => {
			const requestBody = {
				sessionId: "session-123",
				productId: 1,
			};
			const mockCartItem = {
				id: 1,
				productId: 1,
				productName: "Test Product",
				targetAudience: "Developers",
				productCategory: "Software",
				addedAt: new Date().toISOString(),
			};

			mockCartController.addToCart.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.body).toEqual(requestBody);
					res.status(201).json({
						success: true,
						data: mockCartItem,
						message: "Product added to cart successfully",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/add")
				.send(requestBody);

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				success: true,
				data: mockCartItem,
				message: "Product added to cart successfully",
			});
			expect(mockCartController.addToCart).toHaveBeenCalled();
		});

		it("should handle validation errors", async () => {
			const invalidRequestBody = {
				sessionId: "session-123",
				productId: -1, // Invalid: should be positive
			};

			mockCartController.addToCart.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Invalid request data: productId must be a positive number",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/add")
				.send(invalidRequestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.addToCart).toHaveBeenCalled();
		});

		it("should handle missing request body", async () => {
			mockCartController.addToCart.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Request body is required",
					});
				}
			);

			const response = await request(app).post("/api/cart/add");

			expect(response.status).toBe(400);
			expect(mockCartController.addToCart).toHaveBeenCalled();
		});
	});

	describe("DELETE /api/cart/remove", () => {
		it("should call removeFromCart controller with request body", async () => {
			const requestBody = {
				sessionId: "session-123",
				productId: 1,
			};

			mockCartController.removeFromCart.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.body).toEqual(requestBody);
					res.status(200).json({
						success: true,
						message: "Product removed from cart successfully",
					});
				}
			);

			const response = await request(app)
				.delete("/api/cart/remove")
				.send(requestBody);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				success: true,
				message: "Product removed from cart successfully",
			});
			expect(mockCartController.removeFromCart).toHaveBeenCalled();
		});

		it("should handle product not found in cart", async () => {
			const requestBody = {
				sessionId: "session-123",
				productId: 999,
			};

			mockCartController.removeFromCart.mockImplementation(
				(req: Request, res: Response) => {
					res.status(404).json({
						success: false,
						error: "Product not found in cart",
					});
				}
			);

			const response = await request(app)
				.delete("/api/cart/remove")
				.send(requestBody);

			expect(response.status).toBe(404);
			expect(mockCartController.removeFromCart).toHaveBeenCalled();
		});
	});

	describe("GET /api/cart/:sessionId", () => {
		it("should call getCartContents controller with correct sessionId", async () => {
			const sessionId = "session-123";
			const mockCartContents = {
				sessionId,
				items: [
					{
						id: 1,
						productId: 1,
						productName: "Test Product",
						targetAudience: "Developers",
						productCategory: "Software",
						addedAt: new Date().toISOString(),
					},
				],
				totalItems: 1,
				lastUpdated: new Date().toISOString(),
			};

			mockCartController.getCartContents.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.params.sessionId).toBe(sessionId);
					res.status(200).json({
						success: true,
						data: mockCartContents,
					});
				}
			);

			const response = await request(app).get(`/api/cart/${sessionId}`);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				success: true,
				data: mockCartContents,
			});
			expect(mockCartController.getCartContents).toHaveBeenCalled();
		});

		it("should handle empty cart", async () => {
			const sessionId = "session-empty";
			const emptyCart = {
				sessionId,
				items: [],
				totalItems: 0,
				lastUpdated: new Date().toISOString(),
			};

			mockCartController.getCartContents.mockImplementation(
				(req: Request, res: Response) => {
					res.status(200).json({
						success: true,
						data: emptyCart,
					});
				}
			);

			const response = await request(app).get(`/api/cart/${sessionId}`);

			expect(response.status).toBe(200);
			expect(response.body.data.items).toHaveLength(0);
			expect(mockCartController.getCartContents).toHaveBeenCalled();
		});
	});

	describe("GET /api/cart/:sessionId/count", () => {
		it("should call getCartItemCount controller with correct sessionId", async () => {
			const sessionId = "session-123";
			const mockCount = 5;

			mockCartController.getCartItemCount.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.params.sessionId).toBe(sessionId);
					res.status(200).json({
						success: true,
						data: { sessionId, count: mockCount },
					});
				}
			);

			const response = await request(app).get(`/api/cart/${sessionId}/count`);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				success: true,
				data: { sessionId, count: mockCount },
			});
			expect(mockCartController.getCartItemCount).toHaveBeenCalled();
		});

		it("should handle zero count correctly", async () => {
			const sessionId = "session-empty";
			const zeroCount = 0;

			mockCartController.getCartItemCount.mockImplementation(
				(req: Request, res: Response) => {
					res.status(200).json({
						success: true,
						data: { sessionId, count: zeroCount },
					});
				}
			);

			const response = await request(app).get(`/api/cart/${sessionId}/count`);

			expect(response.status).toBe(200);
			expect(response.body.data.count).toBe(0);
			expect(mockCartController.getCartItemCount).toHaveBeenCalled();
		});
	});

	describe("DELETE /api/cart/clear", () => {
		it("should call clearCart controller with request body", async () => {
			const requestBody = {
				sessionId: "session-123",
			};

			mockCartController.clearCart.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.body).toEqual(requestBody);
					res.status(200).json({
						success: true,
						message: "Cart cleared successfully",
					});
				}
			);

			const response = await request(app)
				.delete("/api/cart/clear")
				.send(requestBody);

			expect(response.status).toBe(200);
			expect(response.body).toEqual({
				success: true,
				message: "Cart cleared successfully",
			});
			expect(mockCartController.clearCart).toHaveBeenCalled();
		});

		it("should handle invalid sessionId", async () => {
			const invalidRequestBody = {
				sessionId: "",
			};

			mockCartController.clearCart.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Invalid request data: sessionId should not be empty",
					});
				}
			);

			const response = await request(app)
				.delete("/api/cart/clear")
				.send(invalidRequestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.clearCart).toHaveBeenCalled();
		});
	});

	describe("POST /api/cart/convert", () => {
		it("should call convertToSalesLead controller with request body", async () => {
			const requestBody = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
			};
			const mockSalesLead = {
				id: 1,
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
				status: "pending",
				selectedProducts: [
					{
						id: 1,
						productId: 1,
						productName: "Test Product",
						targetAudience: "Developers",
						productCategory: "Software",
						addedAt: new Date().toISOString(),
					},
				],
				createdAt: new Date().toISOString(),
			};

			mockCartController.convertToSalesLead.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.body).toEqual(requestBody);
					res.status(201).json({
						success: true,
						data: mockSalesLead,
						message: "Cart converted to sales lead successfully",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/convert")
				.send(requestBody);

			expect(response.status).toBe(201);
			expect(response.body).toEqual({
				success: true,
				data: mockSalesLead,
				message: "Cart converted to sales lead successfully",
			});
			expect(mockCartController.convertToSalesLead).toHaveBeenCalled();
		});

		it("should handle invalid email format", async () => {
			const invalidRequestBody = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "invalid-email",
				customerPhone: "+15551234567",
			};

			mockCartController.convertToSalesLead.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Invalid request data: customerEmail must be an email",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/convert")
				.send(invalidRequestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.convertToSalesLead).toHaveBeenCalled();
		});

		it("should handle invalid phone number format", async () => {
			const invalidRequestBody = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "invalid-phone",
			};

			mockCartController.convertToSalesLead.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error:
							"Invalid request data: customerPhone must be a valid phone number",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/convert")
				.send(invalidRequestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.convertToSalesLead).toHaveBeenCalled();
		});

		it("should handle empty cart conversion", async () => {
			const requestBody = {
				sessionId: "session-empty",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
			};

			mockCartController.convertToSalesLead.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error: "Cannot convert empty cart to sales lead",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/convert")
				.send(requestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.convertToSalesLead).toHaveBeenCalled();
		});

		it("should handle missing required customer fields", async () => {
			const incompleteRequestBody = {
				sessionId: "session-123",
				customerName: "John Doe",
				// Missing customerEmail and customerPhone
			};

			mockCartController.convertToSalesLead.mockImplementation(
				(req: Request, res: Response) => {
					res.status(400).json({
						success: false,
						error:
							"Invalid request data: customerEmail should not be empty; customerPhone should not be empty",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/convert")
				.send(incompleteRequestBody);

			expect(response.status).toBe(400);
			expect(mockCartController.convertToSalesLead).toHaveBeenCalled();
		});
	});

	describe("Route Testing", () => {
		it("should handle non-matching HTTP methods", async () => {
			// Test PATCH method on a POST route - this should return 404
			const response = await request(app).patch("/api/cart/session");

			expect(response.status).toBe(404);
		});

		it("should handle completely invalid route paths", async () => {
			// Test a route that doesn't match any pattern at all
			const response = await request(app).get(
				"/api/cart/invalid/path/that/doesnt/exist"
			);

			expect(response.status).toBe(404);
		});

		it("should handle sessionId parameter with special characters", async () => {
			const sessionIdWithSpecialChars = "session-123-abc_def";

			mockCartController.getCartContents.mockImplementation(
				(req: Request, res: Response) => {
					expect(req.params.sessionId).toBe(sessionIdWithSpecialChars);
					res.status(200).json({
						success: true,
						data: {
							sessionId: sessionIdWithSpecialChars,
							items: [],
							totalItems: 0,
							lastUpdated: new Date().toISOString(),
						},
					});
				}
			);

			const response = await request(app).get(
				`/api/cart/${sessionIdWithSpecialChars}`
			);

			expect(response.status).toBe(200);
			expect(mockCartController.getCartContents).toHaveBeenCalled();
		});
	});

	describe("Content-Type Handling", () => {
		it("should handle JSON content type for POST requests", async () => {
			const requestBody = {
				sessionId: "session-123",
				productId: 1,
			};

			mockCartController.addToCart.mockImplementation(
				(req: Request, res: Response) => {
					res.status(201).json({
						success: true,
						data: { id: 1 },
						message: "Product added to cart successfully",
					});
				}
			);

			const response = await request(app)
				.post("/api/cart/add")
				.set("Content-Type", "application/json")
				.send(requestBody);

			expect(response.status).toBe(201);
			expect(mockCartController.addToCart).toHaveBeenCalled();
		});

		it("should handle malformed JSON", async () => {
			const response = await request(app)
				.post("/api/cart/add")
				.set("Content-Type", "application/json")
				.send("{ invalid json }");

			// Express should handle malformed JSON and return 400
			expect(response.status).toBe(400);
		});
	});
});
