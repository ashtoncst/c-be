// test/cart.controller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockedFunction } from "vitest";
import { Request, Response, NextFunction } from "express";

// Add these interface definitions at the top of your test file
interface MockAppErrorOptions {
	isOperational?: boolean;
	details?: Record<string, unknown>;
	cause?: unknown;
}

interface ValidationErrorConstraints {
	[key: string]: string;
}

interface ValidationErrorResult {
	property: string;
	constraints?: ValidationErrorConstraints;
	children?: ValidationErrorResult[];
}

interface MockCartItem {
	id: number;
	productId: number;
	productName: string;
	targetAudience: string;
	productCategory: string;
	addedAt: string;
	description?: string | null;
	price?: string | null;
	contractTerm?: string | null;
}

interface MockCartResponse {
	sessionId: string;
	items: MockCartItem[];
	totalItems: number;
	lastUpdated: string;
}

interface MockSalesLead {
	id: number;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	status: string;
	selectedProducts: MockCartItem[];
	createdAt: string;
}

// interface MockSessionInfo {
// 	sessionId: string;
// 	itemCount: number;
// 	createdAt: string;
// 	expiresAt?: string;
// }

// Type for class-transformer's plainToInstance function
type PlainToInstanceFunction = <T>(cls: new () => T, plain: unknown) => T;

// Type for class-validator's validate function
type ValidateFunction = (object: object) => Promise<ValidationErrorResult[]>;

// Helper functions to avoid repetitive casting
const mockPlainToInstance = (returnValue: unknown) => {
	(
		plainToInstance as unknown as MockedFunction<PlainToInstanceFunction>
	).mockReturnValue(returnValue);
};

const mockValidate = (errors: ValidationErrorResult[] = []) => {
	(validate as unknown as MockedFunction<ValidateFunction>).mockResolvedValue(
		errors
	);
};

// Create mock implementation first
const mockCartService = {
	generateSessionId: vi.fn(),
	getSessionInfo: vi.fn(),
	addToCart: vi.fn(),
	removeFromCart: vi.fn(),
	getCartContents: vi.fn(),
	clearCart: vi.fn(),
	getCartItemCount: vi.fn(),
	convertCartToSalesLead: vi.fn(),
};

// Mock the CartService module
vi.mock("../src/services/cart.service.js", () => ({
	CartService: vi.fn().mockImplementation(() => mockCartService),
}));

// Mock asyncHandler to return the original function for easier testing
vi.mock("../src/utils/async.js", () => ({
	asyncHandler: (
		fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
	) => fn,
}));

// Mock AppError
vi.mock("../src/middleware/errorHandler.js", () => ({
	AppError: class extends Error {
		constructor(
			message: string,
			statusCode: number,
			options: MockAppErrorOptions = {}
		) {
			super(message);
			this.statusCode = statusCode;
			this.options = options;
		}
		statusCode: number;
		options?: MockAppErrorOptions;
	},
}));

// Mock Logger
vi.mock("../src/utils/logger.js", () => ({
	Logger: vi.fn().mockImplementation(() => ({
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	})),
}));

// Mock class-validator using importOriginal to preserve decorators
vi.mock("class-validator", async (importOriginal) => {
	const actual = await importOriginal<typeof import("class-validator")>();
	return {
		...actual,
		validate: vi.fn(),
	};
});

// Mock class-transformer using importOriginal to preserve decorators
vi.mock("class-transformer", async (importOriginal) => {
	const actual = await importOriginal<typeof import("class-transformer")>();
	return {
		...actual,
		plainToInstance: vi.fn(),
	};
});

// Import after mocking
const { default: cartController } = await import(
	"../src/controllers/cart.controller.js"
);
const { validate } = await import("class-validator");
const { plainToInstance } = await import("class-transformer");

describe("CartController", () => {
	let mockRequest: Partial<Request>;
	let mockResponse: Partial<Response>;
	let mockNext: NextFunction;

	beforeEach(() => {
		vi.clearAllMocks();

		mockRequest = {
			body: {},
			params: {},
			query: {},
		};

		mockResponse = {
			status: vi.fn().mockReturnThis(),
			json: vi.fn().mockReturnThis(),
		};

		mockNext = vi.fn();
	});

	describe("generateSession", () => {
		it("should generate a new session successfully", async () => {
			const mockSessionId = "session-12345";
			const mockSessionInfo = {
				sessionId: mockSessionId,
				itemCount: 0,
				createdAt: new Date().toISOString(),
			};

			mockCartService.generateSessionId.mockResolvedValue(mockSessionId);
			mockCartService.getSessionInfo.mockResolvedValue(mockSessionInfo);

			await cartController.generateSession(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.generateSessionId).toHaveBeenCalledOnce();
			expect(mockCartService.getSessionInfo).toHaveBeenCalledWith(
				mockSessionId
			);
			expect(mockResponse.status).toHaveBeenCalledWith(201);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockSessionInfo,
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle service errors", async () => {
			const error = new Error("Session generation failed");
			mockCartService.generateSessionId.mockRejectedValue(error);

			await expect(
				cartController.generateSession(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Session generation failed");
		});
	});

	describe("getSessionInfo", () => {
		it("should return session info successfully", async () => {
			const sessionId = "session-123";
			const mockSessionInfo = {
				sessionId,
				itemCount: 3,
				createdAt: new Date().toISOString(),
			};

			mockRequest.params = { sessionId };
			mockCartService.getSessionInfo.mockResolvedValue(mockSessionInfo);

			await cartController.getSessionInfo(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.getSessionInfo).toHaveBeenCalledWith(sessionId);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockSessionInfo,
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle missing sessionId", async () => {
			mockRequest.params = {};

			await expect(
				cartController.getSessionInfo(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Session ID is required");
		});

		it("should handle service errors", async () => {
			const error = new Error("Session not found");
			mockRequest.params = { sessionId: "invalid-session" };
			mockCartService.getSessionInfo.mockRejectedValue(error);

			await expect(
				cartController.getSessionInfo(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Session not found");
		});
	});

	describe("addToCart", () => {
		it("should add product to cart successfully", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: 1,
			};
			const mockCartItem: MockCartItem = {
				id: 1,
				productId: 1,
				productName: "Test Product",
				targetAudience: "Developers",
				productCategory: "Software",
				addedAt: new Date().toISOString(),
			};

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.addToCart.mockResolvedValue(mockCartItem);

			await cartController.addToCart(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.addToCart).toHaveBeenCalledWith(requestData);
			expect(mockResponse.status).toHaveBeenCalledWith(201);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockCartItem,
				message: "Product added to cart successfully",
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle validation errors", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: -1, // Invalid: should be positive
			};
			const validationErrors: ValidationErrorResult[] = [
				{
					property: "productId",
					constraints: { isPositive: "productId must be a positive number" },
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors);

			await expect(
				cartController.addToCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});

		it("should handle service errors", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: 1,
			};
			const error = new Error("Product not found");

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.addToCart.mockRejectedValue(error);

			await expect(
				cartController.addToCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Product not found");
		});
	});

	describe("removeFromCart", () => {
		it("should remove product from cart successfully", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: 1,
			};

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.removeFromCart.mockResolvedValue(undefined);

			await cartController.removeFromCart(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.removeFromCart).toHaveBeenCalledWith(requestData);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				message: "Item removed from cart successfully",
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle validation errors", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: 0, // Invalid: should be positive
			};
			const validationErrors = [
				{
					property: "productId",
					constraints: { isPositive: "productId must be a positive number" },
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors);

			await expect(
				cartController.removeFromCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});

		it("should handle service errors", async () => {
			const requestData = {
				sessionId: "session-123",
				productId: 1,
			};
			const error = new Error("Cart item not found");

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.removeFromCart.mockRejectedValue(error);

			await expect(
				cartController.removeFromCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Cart item not found");
		});
	});

	describe("getCartContents", () => {
		it("should return cart contents successfully", async () => {
			const sessionId = "session-123";
			const mockCartContents: MockCartResponse = {
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

			mockRequest.params = { sessionId };
			mockCartService.getCartContents.mockResolvedValue(mockCartContents);

			await cartController.getCartContents(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.getCartContents).toHaveBeenCalledWith(sessionId);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockCartContents,
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle missing sessionId", async () => {
			mockRequest.params = {};

			await expect(
				cartController.getCartContents(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Session ID is required");
		});

		it("should handle service errors", async () => {
			const error = new Error("Cart not found");
			mockRequest.params = { sessionId: "invalid-session" };
			mockCartService.getCartContents.mockRejectedValue(error);

			await expect(
				cartController.getCartContents(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Cart not found");
		});
	});

	describe("clearCart", () => {
		it("should clear cart successfully", async () => {
			const requestData = {
				sessionId: "session-123",
			};

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.clearCart.mockResolvedValue(undefined);

			await cartController.clearCart(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.clearCart).toHaveBeenCalledWith(requestData);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				message: "Cart cleared successfully",
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle validation errors", async () => {
			const requestData = {};
			const validationErrors = [
				{
					property: "sessionId",
					constraints: { isNotEmpty: "sessionId should not be empty" },
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors);

			await expect(
				cartController.clearCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});

		it("should handle service errors", async () => {
			const requestData = {
				sessionId: "session-123",
			};
			const error = new Error("Cart clear failed");

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.clearCart.mockRejectedValue(error);

			await expect(
				cartController.clearCart(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Cart clear failed");
		});
	});

	describe("getCartItemCount", () => {
		it("should return cart item count successfully", async () => {
			const sessionId = "session-123";
			const mockCount = 5;

			mockRequest.params = { sessionId };
			mockCartService.getCartItemCount.mockResolvedValue(mockCount);

			await cartController.getCartItemCount(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.getCartItemCount).toHaveBeenCalledWith(sessionId);
			expect(mockResponse.status).toHaveBeenCalledWith(200);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: { sessionId, count: mockCount },
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle missing sessionId", async () => {
			mockRequest.params = {};

			await expect(
				cartController.getCartItemCount(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Session ID is required");
		});

		it("should handle service errors", async () => {
			const error = new Error("Count retrieval failed");
			mockRequest.params = { sessionId: "invalid-session" };
			mockCartService.getCartItemCount.mockRejectedValue(error);

			await expect(
				cartController.getCartItemCount(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Count retrieval failed");
		});
	});

	describe("convertToSalesLead", () => {
		it("should convert cart to sales lead successfully", async () => {
			const requestData = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
			};
			const mockSalesLead: MockSalesLead = {
				id: 1,
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
				status: "pending",
				selectedProducts: [],
				createdAt: new Date().toISOString(),
			};

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.convertCartToSalesLead.mockResolvedValue(mockSalesLead);

			await cartController.convertToSalesLead(
				mockRequest as Request,
				mockResponse as Response,
				mockNext
			);

			expect(mockCartService.convertCartToSalesLead).toHaveBeenCalledWith(
				requestData
			);
			expect(mockResponse.status).toHaveBeenCalledWith(201);
			expect(mockResponse.json).toHaveBeenCalledWith({
				success: true,
				data: mockSalesLead,
				message: "Cart converted to sales lead successfully",
			});
			expect(mockNext).not.toHaveBeenCalled();
		});

		it("should handle validation errors for invalid email", async () => {
			const requestData = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "invalid-email",
				customerPhone: "+15551234567",
			};
			const validationErrors = [
				{
					property: "customerEmail",
					constraints: { isEmail: "customerEmail must be an email" },
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors);

			await expect(
				cartController.convertToSalesLead(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});

		it("should handle validation errors for invalid phone", async () => {
			const requestData = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "invalid-phone",
			};
			const validationErrors = [
				{
					property: "customerPhone",
					constraints: {
						matches: "Phone number must be a valid international phone number",
					},
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors);

			await expect(
				cartController.convertToSalesLead(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});

		it("should handle service errors", async () => {
			const requestData = {
				sessionId: "session-123",
				customerName: "John Doe",
				customerEmail: "john.doe@example.com",
				customerPhone: "+15551234567",
			};
			const error = new Error("Conversion failed");

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(); // Empty array for no errors
			mockCartService.convertCartToSalesLead.mockRejectedValue(error);

			await expect(
				cartController.convertToSalesLead(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Conversion failed");
		});

		it("should handle multiple validation errors", async () => {
			const requestData = {
				sessionId: "",
				customerName: "",
				customerEmail: "invalid-email",
				customerPhone: "invalid-phone",
			};
			const validationErrors = [
				{
					property: "sessionId",
					constraints: { isNotEmpty: "sessionId should not be empty" },
				},
				{
					property: "customerName",
					constraints: { isNotEmpty: "customerName should not be empty" },
				},
				{
					property: "customerEmail",
					constraints: { isEmail: "customerEmail must be an email" },
				},
				{
					property: "customerPhone",
					constraints: {
						matches: "Phone number must be a valid international phone number",
					},
				},
			];

			mockRequest.body = requestData;
			mockPlainToInstance(requestData);
			mockValidate(validationErrors as unknown as ValidationErrorResult[]);

			await expect(
				cartController.convertToSalesLead(
					mockRequest as Request,
					mockResponse as Response,
					mockNext
				)
			).rejects.toThrow("Invalid request data");
		});
	});
});
