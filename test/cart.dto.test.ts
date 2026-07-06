import { describe, it, expect } from "vitest";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import {
	AddToCartDto,
	CreateSalesLeadDto,
	CartResponseDto,
	CartItemDto,
} from "../src/dtos/cart.dto";

describe("Cart DTOs", () => {
	describe("AddToCartDto", () => {
		it("should validate a correct object successfully", async () => {
			const dto = plainToInstance(AddToCartDto, {
				sessionId: "session-123",
				productId: 1,
			});
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should fail if productId is not positive", async () => {
			const dto = plainToInstance(AddToCartDto, {
				sessionId: "session-123",
				productId: -1,
			});
			const errors = await validate(dto);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("productId");
			expect(errors[0].constraints).toHaveProperty("isPositive");
		});

		it("should fail if sessionId is empty", async () => {
			const dto = plainToInstance(AddToCartDto, {
				sessionId: "",
				productId: 1,
			});
			const errors = await validate(dto);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("sessionId");
			expect(errors[0].constraints).toHaveProperty("isNotEmpty");
		});

		it("should strip extraneous properties not defined in the DTO", () => {
			const instance = plainToInstance(
				AddToCartDto,
				{ sessionId: "s", productId: 1, extraField: "should be removed" },
				{ excludeExtraneousValues: true }
			);
			expect(instance).toEqual({ sessionId: "s", productId: 1 });
			expect(instance).not.toHaveProperty("extraField");
		});
	});

	describe("CreateSalesLeadDto", () => {
		const validData = {
			sessionId: "session-abc",
			customerName: "John Doe",
			customerEmail: "john.doe@example.com",
			customerPhone: "+15551234567", // Simple format that should work with regex
		};

		it("should validate a correct object successfully", async () => {
			const dto = plainToInstance(CreateSalesLeadDto, validData);
			const errors = await validate(dto);

			// Debug: log any unexpected errors
			if (errors.length > 0) {
				console.log(
					"Unexpected validation errors:",
					errors.map((e) => ({
						property: e.property,
						value: e.value,
						constraints: e.constraints,
					}))
				);
			}

			expect(errors).toHaveLength(0);
		});

		it("should fail if customerEmail is not a valid email", async () => {
			const dto = plainToInstance(CreateSalesLeadDto, {
				...validData,
				customerEmail: "not-a-valid-email",
			});
			const errors = await validate(dto);

			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("customerEmail");
			expect(errors[0].constraints).toHaveProperty("isEmail");
		});

		it("should fail if customerPhone is not a valid phone number", async () => {
			const dto = plainToInstance(CreateSalesLeadDto, {
				...validData,
				customerPhone: "12345", // Too short, should fail regex
			});
			const errors = await validate(dto);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("customerPhone");
			expect(errors[0].constraints).toHaveProperty("matches");
		});

		it("should validate various international phone number formats", async () => {
			const validPhoneFormats = [
				"+15551234567", // US
				"+441234567890", // UK
				"+33123456789", // France
				"15551234567", // US without +
				"+1 555 123 4567", // US with spaces
				"+1-555-123-4567", // US with dashes
				"(555) 123-4567", // US with parentheses
				"+49 30 12345678", // Germany with spaces
			];

			for (const phone of validPhoneFormats) {
				const dto = plainToInstance(CreateSalesLeadDto, {
					...validData,
					customerPhone: phone,
				});
				const errors = await validate(dto);

				// Debug: log if there are unexpected errors
				if (errors.length > 0) {
					console.log(`Phone validation failed for ${phone}:`, {
						errors: errors.map((e) => ({
							property: e.property,
							constraints: e.constraints,
						})),
					});
				}

				expect(errors).toHaveLength(0);
			}
		});

		it("should fail with empty required fields", async () => {
			const dto = plainToInstance(CreateSalesLeadDto, {
				sessionId: "",
				customerName: "",
				customerEmail: "",
				customerPhone: "",
			});
			const errors = await validate(dto);
			expect(errors.length).toBeGreaterThan(0);

			// Check that all required fields have errors
			const errorProperties = errors.map((err) => err.property);
			expect(errorProperties).toContain("sessionId");
			expect(errorProperties).toContain("customerName");
			expect(errorProperties).toContain("customerEmail");
			expect(errorProperties).toContain("customerPhone");
		});

		it("should fail with invalid phone number patterns", async () => {
			const invalidPhoneFormats = [
				"123", // Too short
				"abc123def", // Contains letters
				"", // Empty
				"+++123456789", // Multiple plus signs
			];

			for (const phone of invalidPhoneFormats) {
				const dto = plainToInstance(CreateSalesLeadDto, {
					...validData,
					customerPhone: phone,
				});
				const errors = await validate(dto);
				expect(errors.length).toBeGreaterThan(0);

				const phoneError = errors.find((e) => e.property === "customerPhone");
				expect(phoneError).toBeDefined();
			}
		});
	});

	describe("CartResponseDto", () => {
		const validCartItem = {
			id: 1,
			productId: 101,
			productName: "Test Product",
			targetAudience: "Developers",
			productCategory: "Software",
			addedAt: new Date().toISOString(),
		};

		const validData = {
			sessionId: "session-123",
			items: [validCartItem],
			totalItems: 1,
			lastUpdated: new Date().toISOString(),
		};

		it("should validate correct data successfully", async () => {
			const dto = plainToInstance(CartResponseDto, validData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should validate empty cart", async () => {
			const emptyCartData = {
				sessionId: "session-123",
				items: [],
				totalItems: 0,
				lastUpdated: new Date().toISOString(),
			};
			const dto = plainToInstance(CartResponseDto, emptyCartData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should fail with empty sessionId", async () => {
			const invalidData = {
				...validData,
				sessionId: "",
			};
			const dto = plainToInstance(CartResponseDto, invalidData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("sessionId");
			expect(errors[0].constraints).toHaveProperty("isNotEmpty");
		});

		it("should correctly validate nested DTOs", async () => {
			const invalidData = {
				...validData,
				items: [{ ...validCartItem, productName: 123 }], // Invalid type
			};
			const dto = plainToInstance(CartResponseDto, invalidData);
			const errors = await validate(dto);

			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("items");
			// Check the nested error path
			const nestedError = errors[0].children?.[0]?.children?.[0];
			expect(nestedError).toBeDefined();
			expect(nestedError?.property).toBe("productName");
			expect(nestedError?.constraints).toHaveProperty("isString");
		});

		it("should transform plain objects to class instances correctly", () => {
			const dto = plainToInstance(CartResponseDto, validData);
			expect(dto.items[0]).toBeInstanceOf(CartItemDto);
		});

		it("should fail with negative totalItems", async () => {
			const invalidData = {
				...validData,
				totalItems: -1,
			};
			const dto = plainToInstance(CartResponseDto, invalidData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(1);
			expect(errors[0].property).toBe("totalItems");
			expect(errors[0].constraints).toHaveProperty("min");
		});
	});

	describe("CartItemDto", () => {
		it("should validate correct cart item data", async () => {
			const validData = {
				id: 1,
				productId: 101,
				productName: "Test Product",
				description: "A test product",
				price: "$99.99",
				contractTerm: "12 months",
				targetAudience: "Developers",
				productCategory: "Software",
				addedAt: new Date().toISOString(),
			};

			const dto = plainToInstance(CartItemDto, validData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should validate cart item with optional fields missing", async () => {
			const minimalData = {
				id: 1,
				productId: 101,
				productName: "Test Product",
				targetAudience: "Developers",
				productCategory: "Software",
				addedAt: new Date().toISOString(),
			};

			const dto = plainToInstance(CartItemDto, minimalData);
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should validate cart item with null optional fields", async () => {
			const dataWithNulls = {
				id: 1,
				productId: 101,
				productName: "Test Product",
				description: null,
				price: null,
				contractTerm: null,
				targetAudience: "Developers",
				productCategory: "Software",
				addedAt: new Date().toISOString(),
			};

			const dto = plainToInstance(CartItemDto, dataWithNulls);
			const errors = await validate(dto);
			expect(errors).toHaveLength(0);
		});

		it("should fail with empty required string fields", async () => {
			const invalidData = {
				id: 1,
				productId: 101,
				productName: "", // Empty string should fail
				addedAt: "", // Empty string should fail
			};

			const dto = plainToInstance(CartItemDto, invalidData);
			const errors = await validate(dto);
			expect(errors.length).toBeGreaterThan(0);

			const errorProperties = errors.map((err) => err.property);
			expect(errorProperties).toContain("productName");
			expect(errorProperties).toContain("addedAt");
			// Note: targetAudience and productCategory are now optional, so they won't fail if empty
		});

		it("should fail with missing required fields", async () => {
			const invalidData = {
				id: 1,
				// Missing required fields
			};

			const dto = plainToInstance(CartItemDto, invalidData);
			const errors = await validate(dto);
			expect(errors.length).toBeGreaterThan(0);

			// Only productName and addedAt are truly required (non-optional)
			const requiredFields = ["productName", "addedAt"];
			const errorProperties = errors.map((err) => err.property);
			requiredFields.forEach((field) => {
				expect(errorProperties).toContain(field);
			});
			// Note: productId, targetAudience, and productCategory are now optional
		});
	});
});
