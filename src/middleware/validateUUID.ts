import { Request, Response, NextFunction } from "express";
import { validate as uuidValidate } from "uuid";
import { ValidationError } from "../utils/errors.js";

/**
 * Middleware to validate UUID parameters in requests
 * @param paramName - The name of the parameter to validate
 * @returns Express middleware function
 */
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuid = req.params[paramName];
    if (!uuidValidate(uuid)) {
      throw new ValidationError(`Invalid UUID format for ${paramName}`);
    }
    next();
  };
};
