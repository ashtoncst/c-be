import { Request, Response, NextFunction } from "express";
import { validate, ValidationError } from "class-validator";
import { plainToInstance, ClassConstructor } from "class-transformer";

/**
 * Middleware to validate request body against a DTO class
 * @param dtoClass The DTO class to validate against
 * @returns Express middleware function
 */
export function validateDto<T extends object>(dtoClass: ClassConstructor<T>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToInstance(dtoClass, req.body, {
      excludeExtraneousValues: false,
      enableImplicitConversion: true,
    });

    const errors = await validate(dtoObject, {
      whitelist: true,
      forbidNonWhitelisted: true,
      skipMissingProperties: false,
    });

    if (errors.length > 0) {
      const formattedErrors = formatValidationErrors(errors);
      return res.status(400).json({
        error: "Validation failed",
        details: formattedErrors,
      });
    }

    req.body = dtoObject;
    next();
  };
}

/**
 * Format validation errors into a more user-friendly structure
 * @param errors Array of ValidationError objects
 * @returns Object with field names as keys and error messages as values
 */
export function formatValidationErrors(
  errors: ValidationError[]
): Record<string, string[]> {
  const formattedErrors: Record<string, string[]> = {};

  errors.forEach((error) => {
    const property = error.property;
    const constraints = error.constraints || {};

    formattedErrors[property] = Object.values(constraints);

    // Handle nested errors
    if (error.children && error.children.length > 0) {
      const nestedErrors = formatValidationErrors(error.children);

      Object.entries(nestedErrors).forEach(([nestedProp, messages]) => {
        formattedErrors[`${property}.${nestedProp}`] = messages;
      });
    }
  });

  return formattedErrors;
}
