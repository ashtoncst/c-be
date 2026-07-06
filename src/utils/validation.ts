/**
 * Validation utility for API requests
 */

import { Request, Response, NextFunction } from "express";
import { ValidationError as AppValidationError } from "../middleware/errorHandler.js";
import { Logger } from "./logger.js";

const logger = new Logger({ serviceName: "validation" });

export interface ValidationSchema {
	[key: string]: {
		type: "string" | "number" | "boolean" | "object" | "array";
		required?: boolean;
		min?: number;
		max?: number;
		pattern?: RegExp;
		enum?: Array<string | number | boolean>;
		validate?: (
			value: unknown
		) => boolean | { valid: boolean; message: string };
		custom?: (value: unknown) => boolean;
		message?: string;
	};
}

interface ValidationError {
	field: string;
	message: string;
}

/**
 * Validates request body against a schema
 * @param schema The validation schema
 * @returns An Express middleware that validates the request body
 */
export const validateBody = (schema: ValidationSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const errors: Record<string, string> = {};

		for (const [field, rules] of Object.entries(schema)) {
			const value = req.body[field];

			// Check required fields
			if (rules.required && (value === undefined || value === "")) {
				errors[field] = rules.message || `${field} is required`;
				continue;
			}

			// Skip validation if value is not provided and not required
			if ((value === undefined || value === "") && !rules.required) {
				continue;
			}

			// Type validation
			if (value !== undefined) {
				if (rules.type === "string" && typeof value !== "string") {
					errors[field] = rules.message || `${field} must be a string`;
				}

				if (
					rules.type === "number" &&
					typeof value !== "number" &&
					isNaN(Number(value))
				) {
					errors[field] = rules.message || `${field} must be a number`;
				}

				if (rules.type === "boolean" && typeof value !== "boolean") {
					errors[field] = rules.message || `${field} must be a boolean`;
				}

				if (
					rules.type === "object" &&
					(typeof value !== "object" || value === null || Array.isArray(value))
				) {
					errors[field] = rules.message || `${field} must be an object`;
				}

				if (rules.type === "array" && !Array.isArray(value)) {
					errors[field] = rules.message || `${field} must be an array`;
				}
			}

			// Range validation for numbers
			if (rules.type === "number" && typeof value === "number") {
				if (rules.min !== undefined && value < rules.min) {
					errors[field] =
						rules.message || `${field} must be at least ${rules.min}`;
				}
				if (rules.max !== undefined && value > rules.max) {
					errors[field] =
						rules.message || `${field} must be at most ${rules.max}`;
				}
			}

			// Length validation for strings
			if (rules.type === "string" && typeof value === "string") {
				if (rules.min !== undefined && value.length < rules.min) {
					errors[field] =
						rules.message ||
						`${field} must be at least ${rules.min} characters`;
				}
				if (rules.max !== undefined && value.length > rules.max) {
					errors[field] =
						rules.message || `${field} must be at most ${rules.max} characters`;
				}
			}

			// Length validation for arrays
			if (rules.type === "array" && Array.isArray(value)) {
				if (rules.min !== undefined && value.length < rules.min) {
					errors[field] =
						rules.message ||
						`${field} must contain at least ${rules.min} items`;
				}
				if (rules.max !== undefined && value.length > rules.max) {
					errors[field] =
						rules.message || `${field} must contain at most ${rules.max} items`;
				}
			}

			// Pattern validation for strings
			if (
				rules.pattern &&
				typeof value === "string" &&
				!rules.pattern.test(value)
			) {
				errors[field] = rules.message || `${field} format is invalid`;
			}

			// Enum validation
			if (rules.enum && !rules.enum.includes(value)) {
				errors[field] =
					rules.message || `${field} must be one of: ${rules.enum.join(", ")}`;
			}

			// Custom validation
			if (rules.custom && !rules.custom(value)) {
				errors[field] = rules.message || `${field} is invalid`;
			}
		}

		if (Object.keys(errors).length > 0) {
			logger.info("Body validation failed", {
				errors,
				path: req.path,
				body: process.env.NODE_ENV === "development" ? req.body : "[redacted]",
			});
			next(new AppValidationError("Validation error", errors));
			return;
		}

		next();
	};
};

/**
 * Validates query parameters against a schema
 * @param schema The validation schema
 * @returns An Express middleware that validates the request query parameters
 */
export const validateQuery = (schema: ValidationSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const errors: Record<string, string> = {};

		for (const [param, rules] of Object.entries(schema)) {
			const value = req.query[param];

			// Check required params
			if (rules.required && (value === undefined || value === "")) {
				errors[param] = rules.message || `${param} is required`;
				continue;
			}

			// Skip validation if value is not provided and not required
			if ((value === undefined || value === "") && !rules.required) {
				continue;
			}

			// Type validation - for queries, everything comes as string
			if (rules.type === "number" && isNaN(Number(value))) {
				errors[param] = rules.message || `${param} must be a number`;
			}

			// Range validation for numbers
			if (rules.type === "number" && !isNaN(Number(value))) {
				const numValue = Number(value);
				if (rules.min !== undefined && numValue < rules.min) {
					errors[param] =
						rules.message || `${param} must be at least ${rules.min}`;
				}
				if (rules.max !== undefined && numValue > rules.max) {
					errors[param] =
						rules.message || `${param} must be at most ${rules.max}`;
				}
			}

			// Length validation for strings
			if (rules.type === "string" && typeof value === "string") {
				if (rules.min !== undefined && value.length < rules.min) {
					errors[param] =
						rules.message ||
						`${param} must be at least ${rules.min} characters`;
				}
				if (rules.max !== undefined && value.length > rules.max) {
					errors[param] =
						rules.message || `${param} must be at most ${rules.max} characters`;
				}
			}

			// Pattern validation
			if (rules.pattern && !rules.pattern.test(String(value))) {
				errors[param] = rules.message || `${param} format is invalid`;
			}

			// Enum validation - make sure we convert the value to string for comparison
			if (rules.enum && value !== undefined) {
				const stringValue = String(value);
				if (!rules.enum.some((item) => String(item) === stringValue)) {
					errors[param] =
						rules.message ||
						`${param} must be one of: ${rules.enum.join(", ")}`;
				}
			}

			// Custom validation
			if (rules.custom && !rules.custom(value)) {
				errors[param] = rules.message || `${param} is invalid`;
			}
		}

		if (Object.keys(errors).length > 0) {
			logger.info("Query validation failed", { errors, path: req.path });
			next(new AppValidationError("Validation error", errors));
			return;
		}

		next();
	};
};

/**
 * Validates URL parameters against a schema
 * @param schema The validation schema
 * @returns An Express middleware that validates URL parameters
 */
export const validateParams = (schema: ValidationSchema) => {
	return (req: Request, res: Response, next: NextFunction) => {
		const errors: Record<string, string> = {};

		for (const [param, rules] of Object.entries(schema)) {
			const value = req.params[param];

			// Check required params
			if (rules.required && (value === undefined || value === "")) {
				errors[param] = rules.message || `${param} is required`;
				continue;
			}

			// Skip validation if value is not provided and not required
			if ((value === undefined || value === "") && !rules.required) {
				continue;
			}

			// Type validation
			if (rules.type === "number" && isNaN(Number(value))) {
				errors[param] = rules.message || `${param} must be a number`;
			}

			// Range validation for numbers
			if (rules.type === "number" && !isNaN(Number(value))) {
				const numValue = Number(value);
				if (rules.min !== undefined && numValue < rules.min) {
					errors[param] =
						rules.message || `${param} must be at least ${rules.min}`;
				}
				if (rules.max !== undefined && numValue > rules.max) {
					errors[param] =
						rules.message || `${param} must be at most ${rules.max}`;
				}
			}

			// Length validation for strings
			if (rules.type === "string" && typeof value === "string") {
				if (rules.min !== undefined && value.length < rules.min) {
					errors[param] =
						rules.message ||
						`${param} must be at least ${rules.min} characters`;
				}
				if (rules.max !== undefined && value.length > rules.max) {
					errors[param] =
						rules.message || `${param} must be at most ${rules.max} characters`;
				}
			}

			// Pattern validation
			if (rules.pattern && !rules.pattern.test(String(value))) {
				errors[param] = rules.message || `${param} format is invalid`;
			}

			// Enum validation
			if (rules.enum && !rules.enum.includes(value)) {
				errors[param] =
					rules.message || `${param} must be one of: ${rules.enum.join(", ")}`;
			}

			// Custom validation
			if (rules.custom && !rules.custom(value)) {
				errors[param] = rules.message || `${param} is invalid`;
			}
		}

		if (Object.keys(errors).length > 0) {
			logger.info("Parameter validation failed", { errors, path: req.path });
			next(new AppValidationError("Validation error", errors));
			return;
		}

		next();
	};
};

/**
 * Validates data against a schema
 * @param data The data to validate
 * @param schema The validation schema
 * @returns Array of validation errors
 */
export function validateData(
	data: Record<string, unknown>,
	schema: ValidationSchema
): ValidationError[] {
	const errors: ValidationError[] = [];

	for (const [field, rules] of Object.entries(schema)) {
		const value = data[field];

		// Check required fields
		if (
			rules.required &&
			(value === undefined || value === null || value === "")
		) {
			errors.push({ field, message: `${field} is required` });
			continue;
		}

		// Skip validation for undefined optional fields
		if (value === undefined) {
			continue;
		}

		// Type checking
		if (value !== undefined && value !== null) {
			if (rules.type === "string" && typeof value !== "string") {
				errors.push({ field, message: `${field} must be a string` });
			} else if (rules.type === "number" && typeof value !== "number") {
				errors.push({ field, message: `${field} must be a number` });
			} else if (rules.type === "boolean" && typeof value !== "boolean") {
				errors.push({ field, message: `${field} must be a boolean` });
			} else if (
				rules.type === "object" &&
				(typeof value !== "object" || Array.isArray(value))
			) {
				errors.push({ field, message: `${field} must be an object` });
			} else if (rules.type === "array" && !Array.isArray(value)) {
				errors.push({ field, message: `${field} must be an array` });
			}
		}

		// Length/size validation for strings and arrays
		if (typeof value === "string" || Array.isArray(value)) {
			if (rules.min !== undefined && value.length < rules.min) {
				errors.push({
					field,
					message: `${field} must be at least ${rules.min} characters${
						Array.isArray(value) ? " long" : ""
					}`,
				});
			}

			if (rules.max !== undefined && value.length > rules.max) {
				errors.push({
					field,
					message: `${field} must be no more than ${rules.max} characters${
						Array.isArray(value) ? " long" : ""
					}`,
				});
			}
		}

		// Min/max for numbers
		if (typeof value === "number") {
			if (rules.min !== undefined && value < rules.min) {
				errors.push({
					field,
					message: `${field} must be at least ${rules.min}`,
				});
			}

			if (rules.max !== undefined && value > rules.max) {
				errors.push({
					field,
					message: `${field} must be no more than ${rules.max}`,
				});
			}
		}

		// Pattern matching for strings
		if (
			typeof value === "string" &&
			rules.pattern &&
			!rules.pattern.test(value)
		) {
			errors.push({ field, message: `${field} has an invalid format` });
		}

		// Enum validation
		if (
			rules.enum &&
			(typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean")
		) {
			if (!rules.enum.includes(value as string | number | boolean)) {
				errors.push({
					field,
					message: `${field} must be one of: ${rules.enum.join(", ")}`,
				});
			}
		}

		// Custom validation
		if (rules.validate && typeof rules.validate === "function") {
			const result = rules.validate(value);

			if (typeof result === "boolean") {
				if (!result) {
					errors.push({ field, message: `${field} is invalid` });
				}
			} else if (result && !result.valid) {
				errors.push({ field, message: result.message });
			}
		}
	}

	return errors;
}
