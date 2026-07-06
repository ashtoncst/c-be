import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { MockedFunction } from "vitest";
import { CartService } from "../src/services/cart.service";
import { NotFoundError, ValidationError } from "../src/middleware/errorHandler";
import { AddToCartDto, CreateSalesLeadDto } from "../src/dtos/cart.dto";

// Add proper type definitions
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

interface MockDbQueryBuilder {
  from: MockedFunction<() => MockDbQueryBuilder>;
  where: MockedFunction<() => Promise<unknown[]>>;
  leftJoin: MockedFunction<() => MockDbQueryBuilder>;
  values: MockedFunction<() => MockDbQueryBuilder>;
  returning: MockedFunction<() => Promise<unknown[]>>;
}

interface MockDb {
  select: MockedFunction<() => MockDbQueryBuilder>;
  insert: MockedFunction<() => MockDbQueryBuilder>;
  delete: MockedFunction<() => MockDbQueryBuilder>;
}

const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
    } as MockDb,
  };
});

vi.mock("../src/db/index.js", () => ({
  db: mockDb,
}));

describe("CartService", () => {
  let cartService: CartService;

  beforeEach(() => {
    cartService = new CartService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("addToCart", () => {
    const addToCartDto: AddToCartDto = {
      sessionId: "session-123",
      productId: 1,
    };

    it("should add a product to the cart successfully", async () => {
      // Mock product exists check
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ id: 1 }]),
      } as MockDbQueryBuilder);

      // Mock existing cart item check (empty - product not in cart)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([]),
      } as MockDbQueryBuilder);

      // Mock insert operation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValueOnce([{ id: 99, createdAt: new Date() }]),
      } as MockDbQueryBuilder);

      // Mock getting cart item details
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([
          {
            id: 99,
            productId: 1,
            productName: "Test Product",
            targetAudience: "Enterprise",
            productCategory: "Data",
            addedAt: new Date(),
          },
        ]),
      } as MockDbQueryBuilder);

      const result = await cartService.addToCart(addToCartDto);

      expect(result).toBeDefined();
      expect(result.productId).toBe(addToCartDto.productId);
    });

    it("should throw NotFoundError if the product does not exist", async () => {
      // Arrange: Mock product check to return an empty array
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([]),
      } as MockDbQueryBuilder);

      // Act & Assert: The error is NOT wrapped, so we expect NotFoundError directly.
      await expect(cartService.addToCart(addToCartDto)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw ValidationError if the product is already in the cart", async () => {
      // Mock product exists
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ id: 1 }]),
      } as MockDbQueryBuilder);

      // Mock product already in cart (not converted to sales lead)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ id: 99 }]),
      } as MockDbQueryBuilder);

      const promise = cartService.addToCart(addToCartDto);
      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toHaveProperty(
        "message",
        "Item already in cart"
      );
    });
  });

  describe("convertCartToSalesLead", () => {
    const leadDto: CreateSalesLeadDto = {
      sessionId: "session-123",
      customerName: "Test User",
      customerEmail: "test@example.com",
      customerPhone: "+15551234567",
    };

    it("should throw ValidationError if the cart is empty", async () => {
      // ✅ FIXED: Replace 'as any' with proper type
      const emptyCartResponse: MockCartResponse = {
        sessionId: "session-123",
        items: [],
        totalItems: 0,
        lastUpdated: new Date().toISOString(),
      };

      vi.spyOn(cartService, "getCartContents").mockResolvedValue(
        emptyCartResponse
      );

      const promise = cartService.convertCartToSalesLead(leadDto);
      await expect(promise).rejects.toThrow(ValidationError);
      await expect(promise).rejects.toHaveProperty(
        "message",
        "Cannot convert empty cart to sales lead"
      );
    });

    it("should convert cart to sales lead successfully", async () => {
      const cartWithItems: MockCartResponse = {
        sessionId: "session-123",
        items: [
          {
            id: 1,
            productId: 1001,
            productName: "eLine",
            targetAudience: "Enterprise",
            productCategory: "Data",
            addedAt: new Date().toISOString(),
            description: "MEF certified ethernet connectivity",
            price: null,
            contractTerm: null,
          },
        ],
        totalItems: 1,
        lastUpdated: new Date().toISOString(),
      };

      // Mock getCartContents to return cart with items
      vi.spyOn(cartService, "getCartContents").mockResolvedValue(cartWithItems);

      // Mock sales lead creation
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValueOnce([
          {
            id: 1,
            customerName: leadDto.customerName,
            customerEmail: leadDto.customerEmail,
            customerPhone: leadDto.customerPhone,
            status: "New",
            createdAt: new Date(),
          },
        ]),
      } as MockDbQueryBuilder);

      // Mock user selections query (only unconverted items)
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValueOnce([{ id: 1 }]),
      } as MockDbQueryBuilder);

      // Mock linking cart items to sales lead
      mockDb.insert.mockReturnValueOnce({
        values: vi.fn().mockReturnThis(),
      } as MockDbQueryBuilder);

      const result = await cartService.convertCartToSalesLead(leadDto);

      expect(result).toBeDefined();
      expect(result.customerName).toBe(leadDto.customerName);
      expect(result.customerEmail).toBe(leadDto.customerEmail);
      expect(result.selectedProducts).toHaveLength(1);
    });
  });
});
