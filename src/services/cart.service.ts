// src/services/cart.service.ts

/**
 * CartService: Manages user shopping cart and sales lead operations
 *
 * Responsibilities:
 * - Add/remove/clear items in user's cart
 * - Get cart contents with full product details
 * - Convert cart to sales lead with customer contact information
 * - Track user selections and session information
 *
 * All operations are tied to sessionId for stateful cart management.
 */

import { db } from "../db/index.js";
import { eq, and, desc, count, lt, inArray, isNull } from "drizzle-orm";
import {
  userSelection,
  product,
  productCategory,
  targetAudience,
  item,
  salesLead,
  salesLeadUserSelection,
} from "../models/schema.model.js";
import {
  AddToCartDto,
  RemoveFromCartDto,
  ClearCartDto,
  CartResponseDto,
  CartItemDto,
  CreateSalesLeadDto,
  SalesLeadResponseDto,
  SessionInfoDto,
} from "../dtos/cart.dto.js";
import { plainToInstance } from "class-transformer";
import { v4 as uuidv4 } from "uuid";
import { executeDbOperation, throwIfNotFound } from "../utils/errorUtils.js";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.js";
import { Logger } from "../utils/logger.js";
import { emailService } from "./email.service.js";

const logger = new Logger({ serviceName: "CartService" });

export class CartService {
  // Session Management
  async generateSessionId(): Promise<string> {
    const sessionId = uuidv4();
    logger.info("Generated new session ID", { sessionId });
    return sessionId;
  }

  async getSessionInfo(sessionId: string): Promise<SessionInfoDto> {
    return executeDbOperation(
      async () => {
        // Count only unconverted items
        const items = await db
          .select({ count: count() })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, sessionId),
              isNull(salesLeadUserSelection.userSelectionId)
            )
          );

        const itemCount = items[0]?.count || 0;

        // Get first unconverted item for creation date
        const [firstItem] = await db
          .select({ createdAt: userSelection.createdAt })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, sessionId),
              isNull(salesLeadUserSelection.userSelectionId)
            )
          )
          .orderBy(userSelection.createdAt)
          .limit(1);

        return plainToInstance(SessionInfoDto, {
          sessionId,
          itemCount,
          createdAt:
            firstItem?.createdAt?.toISOString() || new Date().toISOString(),
          expiresAt: firstItem?.createdAt
            ? new Date(
                firstItem.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000
              ).toISOString()
            : undefined,
        });
      },
      "cart",
      "getSessionInfo"
    );
  }

  // Core Cart Operations
  async addToCart(dto: AddToCartDto): Promise<CartItemDto> {
    return executeDbOperation(
      async () => {
        // Support both productId (legacy) and itemId (new)
        const itemId = dto.itemId || dto.productId;

        if (!itemId) {
          throw new ValidationError(
            "Either productId or itemId must be provided",
            {}
          );
        }

        logger.info("Adding item to cart", {
          sessionId: dto.sessionId,
          itemId,
          productId: dto.productId,
        });

        // Verify item exists (check new item table first, fallback to product)
        let itemExists;
        if (dto.itemId) {
          [itemExists] = await db
            .select({ id: item.id })
            .from(item)
            .where(and(eq(item.id, dto.itemId), eq(item.isActive, true)));
          throwIfNotFound(itemExists, "Item", dto.itemId.toString());
        } else {
          // Legacy: check product table
          [itemExists] = await db
            .select({ id: product.id })
            .from(product)
            .where(eq(product.id, dto.productId!));
          throwIfNotFound(itemExists, "Product", dto.productId!.toString());
        }

        // Check if item already in cart (only unconverted items)
        const itemCondition = dto.itemId
          ? eq(userSelection.itemId, dto.itemId)
          : eq(userSelection.productId, dto.productId!);

        const [existingItem] = await db
          .select({ id: userSelection.id })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, dto.sessionId),
              itemCondition,
              isNull(salesLeadUserSelection.userSelectionId) // Not linked to sales lead
            )
          );

        if (existingItem) {
          throw new ValidationError("Item already in cart", {
            itemId: "This item is already in the cart",
          });
        }

        // Add to cart - support both itemId (new) and productId (legacy)
        const insertValues: {
          sessionId: string;
          itemId?: number;
          productId?: number;
        } = {
          sessionId: dto.sessionId,
        };

        if (dto.itemId) {
          // Use itemId only (don't populate productId to avoid FK constraint issues)
          insertValues.itemId = dto.itemId;
        } else if (dto.productId) {
          // Legacy: use productId only
          insertValues.productId = dto.productId;
        }

        const [newSelection] = await db
          .insert(userSelection)
          .values(insertValues)
          .returning({
            id: userSelection.id,
            createdAt: userSelection.createdAt,
          });

        // Get full item details for response
        const [cartItem] = await this.getCartItemDetails(newSelection.id);

        logger.info("Item added to cart successfully", {
          sessionId: dto.sessionId,
          itemId,
          selectionId: newSelection.id,
        });

        return cartItem;
      },
      "cart",
      "addToCart"
    );
  }

  async removeFromCart(dto: RemoveFromCartDto): Promise<void> {
    return executeDbOperation(
      async () => {
        // Support both productId (legacy) and itemId (new)
        const itemId = dto.itemId || dto.productId;

        if (!itemId) {
          throw new ValidationError(
            "Either productId or itemId must be provided",
            {}
          );
        }

        logger.info("Removing item from cart", {
          sessionId: dto.sessionId,
          itemId,
          productId: dto.productId,
        });

        // Build base where condition based on which ID is provided
        const itemCondition = dto.itemId
          ? eq(userSelection.itemId, dto.itemId)
          : eq(userSelection.productId, dto.productId!);

        // First, check if the item exists and is not linked to a sales lead
        const [itemToRemove] = await db
          .select({ id: userSelection.id })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, dto.sessionId),
              itemCondition,
              isNull(salesLeadUserSelection.userSelectionId)
            )
          );

        if (!itemToRemove) {
          throw new NotFoundError(
            "Item not found in cart or already converted to sales lead"
          );
        }

        const result = await db
          .delete(userSelection)
          .where(eq(userSelection.id, itemToRemove.id))
          .returning({ id: userSelection.id });

        logger.info("Item removed from cart successfully", {
          sessionId: dto.sessionId,
          itemId,
          removedCount: result.length,
        });
      },
      "cart",
      "removeFromCart"
    );
  }

  async getCartContents(sessionId: string): Promise<CartResponseDto> {
    return executeDbOperation(
      async () => {
        logger.debug("Fetching cart contents", { sessionId });

        // Get selections that are NOT linked to any sales lead
        const selections = await db
          .select({
            id: userSelection.id,
          })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, sessionId),
              isNull(salesLeadUserSelection.userSelectionId) // Not linked to any sales lead
            )
          )
          .orderBy(desc(userSelection.createdAt));

        const items: CartItemDto[] = [];
        for (const selection of selections) {
          const [item] = await this.getCartItemDetails(selection.id);
          if (item) items.push(item);
        }

        const lastUpdated =
          items.length > 0
            ? items.reduce(
                (latest, item) =>
                  new Date(item.addedAt) > new Date(latest)
                    ? item.addedAt
                    : latest,
                items[0].addedAt
              )
            : new Date().toISOString();

        return plainToInstance(CartResponseDto, {
          sessionId,
          items,
          totalItems: items.length,
          lastUpdated,
        });
      },
      "cart",
      "getCartContents"
    );
  }

  async clearCart(dto: ClearCartDto): Promise<void> {
    return executeDbOperation(
      async () => {
        logger.info("Clearing cart", { sessionId: dto.sessionId });

        // Get only items that are NOT linked to any sales lead
        const unconvertedSelections = await db
          .select({ id: userSelection.id })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, dto.sessionId),
              isNull(salesLeadUserSelection.userSelectionId)
            )
          );

        if (unconvertedSelections.length === 0) {
          logger.info("No unconverted items to clear", {
            sessionId: dto.sessionId,
          });
          return;
        }

        const idsToDelete = unconvertedSelections.map((s) => s.id);

        const result = await db
          .delete(userSelection)
          .where(inArray(userSelection.id, idsToDelete))
          .returning({ id: userSelection.id });

        logger.info("Cart cleared successfully", {
          sessionId: dto.sessionId,
          itemsRemoved: result.length,
          note: "Only unconverted items were cleared",
        });
      },
      "cart",
      "clearCart"
    );
  }

  async getCartItemCount(sessionId: string): Promise<number> {
    return executeDbOperation(
      async () => {
        // Count only selections that are NOT linked to any sales lead
        const [result] = await db
          .select({ count: count() })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, sessionId),
              isNull(salesLeadUserSelection.userSelectionId) // Not linked to any sales lead
            )
          );

        return result?.count || 0;
      },
      "cart",
      "getCartItemCount"
    );
  }

  // Lead Conversion
  async convertCartToSalesLead(
    dto: CreateSalesLeadDto
  ): Promise<SalesLeadResponseDto> {
    return executeDbOperation(
      async () => {
        logger.info("Converting cart to sales lead", {
          sessionId: dto.sessionId,
          customerEmail: dto.customerEmail,
        });

        // Get current cart contents
        const cartContents = await this.getCartContents(dto.sessionId);

        if (cartContents.items.length === 0) {
          throw new ValidationError("Cannot convert empty cart to sales lead", {
            cart: "Cart must contain at least one item before conversion",
          });
        }

        logger.info("Cart contents before conversion", {
          sessionId: dto.sessionId,
          itemCount: cartContents.items.length,
          items: cartContents.items.map((item) => ({
            id: item.id,
            itemId: item.itemId,
            productId: item.productId,
          })),
        });

        // Create sales lead
        const [newLead] = await db
          .insert(salesLead)
          .values({
            customerName: dto.customerName,
            customerEmail: dto.customerEmail,
            customerPhone: dto.customerPhone,
            status: "New",
          })
          .returning({
            id: salesLead.id,
            customerName: salesLead.customerName,
            customerEmail: salesLead.customerEmail,
            customerPhone: salesLead.customerPhone,
            status: salesLead.status,
            createdAt: salesLead.createdAt,
          });

        logger.info("Sales lead created", {
          salesLeadId: newLead.id,
          sessionId: dto.sessionId,
        });

        // Link only unconverted cart items to sales lead
        const userSelections = await db
          .select({ id: userSelection.id })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              eq(userSelection.sessionId, dto.sessionId),
              isNull(salesLeadUserSelection.userSelectionId)
            )
          );

        logger.info("Linking cart items to sales lead", {
          salesLeadId: newLead.id,
          userSelectionCount: userSelections.length,
          userSelectionIds: userSelections.map((s) => s.id),
        });

        for (const selection of userSelections) {
          await db.insert(salesLeadUserSelection).values({
            salesLeadId: newLead.id,
            userSelectionId: selection.id,
          });
        }

        logger.info("Cart items linked to sales lead", {
          salesLeadId: newLead.id,
          linkedCount: userSelections.length,
        });

        logger.info("Cart converted to sales lead successfully", {
          sessionId: dto.sessionId,
          salesLeadId: newLead.id,
          productCount: cartContents.items.length,
          note: "Cart items are now linked and will be filtered out from active cart queries",
        });

        // Send email notification (non-blocking)
        const emailSent = await emailService.sendSalesLeadEmail({
          customerName: dto.customerName,
          customerEmail: dto.customerEmail,
          companyName: dto.companyName,
          officeAddress: dto.officeAddress,
          customerPhone: dto.customerPhone,
          selectedProducts: cartContents.items,
        });

        logger.info("Sales lead email notification status", {
          salesLeadId: newLead.id,
          emailSent,
        });

        return plainToInstance(SalesLeadResponseDto, {
          id: newLead.id,
          customerName: newLead.customerName,
          customerEmail: newLead.customerEmail,
          companyName: dto.companyName,
          officeAddress: dto.officeAddress,
          customerPhone: newLead.customerPhone,
          status: newLead.status,
          selectedProducts: cartContents.items,
          createdAt:
            newLead.createdAt?.toISOString() || new Date().toISOString(),
        });
      },
      "cart",
      "convertCartToSalesLead"
    );
  }

  // Session Cleanup
  async cleanupExpiredSessions(daysOld: number = 30): Promise<number> {
    return executeDbOperation(
      async () => {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        logger.info("Starting cleanup of expired sessions", {
          cutoffDate: cutoffDate.toISOString(),
          daysOld,
        });

        // Get unconverted user selections older than cutoff date
        const expiredSelections = await db
          .select({ id: userSelection.id })
          .from(userSelection)
          .leftJoin(
            salesLeadUserSelection,
            eq(userSelection.id, salesLeadUserSelection.userSelectionId)
          )
          .where(
            and(
              lt(userSelection.createdAt, cutoffDate),
              isNull(salesLeadUserSelection.userSelectionId) // Only unconverted items
            )
          );

        if (expiredSelections.length === 0) {
          logger.info("No expired sessions to clean up");
          return 0;
        }

        const idsToDelete = expiredSelections.map((s) => s.id);

        const result = await db
          .delete(userSelection)
          .where(inArray(userSelection.id, idsToDelete))
          .returning({ id: userSelection.id });

        logger.info("Cleaned up expired sessions", {
          cutoffDate: cutoffDate.toISOString(),
          sessionsRemoved: result.length,
          note: "Only unconverted items were removed. Items linked to sales leads are preserved.",
        });

        return result.length;
      },
      "cart",
      "cleanupExpiredSessions"
    );
  }

  // Helper Methods
  private async getCartItemDetails(
    selectionId: number
  ): Promise<CartItemDto[]> {
    const results = await db
      .select({
        id: userSelection.id,
        itemId: userSelection.itemId,
        productId: userSelection.productId,
        itemName: item.name,
        itemType: item.itemType,
        productName: product.name,
        description: item.description,
        price: item.price,
        contractTerm: item.contractTerm,
        targetAudience: targetAudience.name,
        productCategory: productCategory.name,
        addedAt: userSelection.createdAt,
      })
      .from(userSelection)
      .leftJoin(item, eq(userSelection.itemId, item.id))
      .leftJoin(product, eq(userSelection.productId, product.id))
      .leftJoin(targetAudience, eq(item.targetAudienceId, targetAudience.id))
      .leftJoin(
        productCategory,
        eq(product.productCategoryId, productCategory.id)
      )
      .where(eq(userSelection.id, selectionId));

    return results
      .filter((r) => r.itemId !== null || r.productId !== null)
      .map((r) =>
        plainToInstance(CartItemDto, {
          id: r.id,
          itemId: r.itemId || undefined,
          productId: r.productId || undefined,
          itemName: r.itemName || r.productName || "Unknown",
          productName: r.productName || r.itemName || "Unknown",
          itemType: r.itemType as
            | "solution"
            | "category"
            | "product"
            | undefined,
          description: r.description,
          price: r.price,
          contractTerm: r.contractTerm,
          targetAudience: r.targetAudience || "Unknown",
          productCategory: r.productCategory || "Unknown",
          addedAt: r.addedAt?.toISOString() || new Date().toISOString(),
        })
      );
  }
}
