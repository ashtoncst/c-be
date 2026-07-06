import { Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  AddToCartDto,
  RemoveFromCartDto,
  ClearCartDto,
  CreateSalesLeadDto,
} from "../dtos/cart.dto.js";
import { CartService } from "../services/cart.service.js";
import { asyncHandler } from "../utils/async.js";
import { AppError } from "../middleware/errorHandler.js";
import { Logger } from "../utils/logger.js";

const logger = new Logger({ serviceName: "CartController" });

class CartController {
  private cartService = new CartService();

  /**
   * POST /api/cart/session
   * Generate a new session ID for ephemeral users
   */
  generateSession = asyncHandler(async (req: Request, res: Response) => {
    logger.info("Generating new session ID");

    const sessionId = await this.cartService.generateSessionId();
    const sessionInfo = await this.cartService.getSessionInfo(sessionId);

    res.status(201).json({
      success: true,
      data: sessionInfo,
    });
  });

  /**
   * GET /api/cart/session/:sessionId
   * Get session information
   */
  getSessionInfo = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new AppError("Session ID is required", 400);
    }

    const sessionInfo = await this.cartService.getSessionInfo(sessionId);
    res.status(200).json({
      success: true,
      data: sessionInfo,
    });
  });

  /**
   * POST /api/cart/add
   * Add a product to the cart
   */
  addToCart = asyncHandler(async (req: Request, res: Response) => {
    const dto = plainToInstance(AddToCartDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error) => Object.values(error.constraints || {}).join(", "))
        .join("; ");

      throw new AppError(`Invalid request data: ${errorMessages}`, 400, {
        details: { validationErrors },
      });
    }

    // Custom validation: at least one of productId or itemId must be provided
    if (!dto.productId && !dto.itemId) {
      throw new AppError("Either productId or itemId must be provided", 400);
    }

    const cartItem = await this.cartService.addToCart(dto);

    res.status(201).json({
      success: true,
      data: cartItem,
      message: "Product added to cart successfully",
    });
  });

  /**
   * DELETE /api/cart/remove
   * Remove an item from the cart
   */
  removeFromCart = asyncHandler(async (req: Request, res: Response) => {
    const dto = plainToInstance(RemoveFromCartDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error) => Object.values(error.constraints || {}).join(", "))
        .join("; ");

      throw new AppError(`Invalid request data: ${errorMessages}`, 400, {
        details: { validationErrors },
      });
    }

    // Custom validation: at least one of productId or itemId must be provided
    if (!dto.productId && !dto.itemId) {
      throw new AppError("Either productId or itemId must be provided", 400);
    }

    await this.cartService.removeFromCart(dto);

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
    });
  });

  /**
   * GET /api/cart/:sessionId
   * Get cart contents for a session
   */
  getCartContents = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new AppError("Session ID is required", 400);
    }

    const cartContents = await this.cartService.getCartContents(sessionId);

    res.status(200).json({
      success: true,
      data: cartContents,
    });
  });

  /**
   * DELETE /api/cart/clear
   * Clear entire cart for a session
   */
  clearCart = asyncHandler(async (req: Request, res: Response) => {
    const dto = plainToInstance(ClearCartDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error) => Object.values(error.constraints || {}).join(", "))
        .join("; ");

      throw new AppError(`Invalid request data: ${errorMessages}`, 400, {
        details: { validationErrors },
      });
    }

    await this.cartService.clearCart(dto);

    res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  });

  /**
   * GET /api/cart/:sessionId/count
   * Get cart item count for a session
   */
  getCartItemCount = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new AppError("Session ID is required", 400);
    }

    const count = await this.cartService.getCartItemCount(sessionId);

    res.status(200).json({
      success: true,
      data: { sessionId, count },
    });
  });

  /**
   * POST /api/cart/convert
   * Convert ephemeral cart to sales lead
   */
  convertToSalesLead = asyncHandler(async (req: Request, res: Response) => {
    const dto = plainToInstance(CreateSalesLeadDto, req.body);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error) => Object.values(error.constraints || {}).join(", "))
        .join("; ");

      throw new AppError(`Invalid request data: ${errorMessages}`, 400, {
        details: { validationErrors },
      });
    }

    const salesLead = await this.cartService.convertCartToSalesLead(dto);

    res.status(201).json({
      success: true,
      data: salesLead,
      message: "Cart converted to sales lead successfully",
    });
  });
}

export default new CartController();
