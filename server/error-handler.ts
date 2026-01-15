/**
 * Centralized Error Handling Middleware
 * 
 * Provides consistent error responses and logging
 */

import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { logger } from "./logger";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Create a standardized error response
 */
function createErrorResponse(error: AppError | Error, includeStack = false) {
  const response: any = {
    success: false,
    message: error.message || "An unexpected error occurred",
  };

  if (includeStack && process.env.NODE_ENV !== "production") {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Global error handling middleware
 * Should be added as the last middleware in the Express app
 */
export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log error using structured logger
  logger.error("Unhandled request error", "server", {
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = fromZodError(error);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: validationError.message,
    });
  }

  // Handle operational errors (known errors)
  if ((error as AppError).isOperational) {
    const statusCode = (error as AppError).statusCode || 500;
    return res.status(statusCode).json(
      createErrorResponse(error, false)
    );
  }

  // Handle specific error types
  if (error.message.includes("not found")) {
    return res.status(404).json(createErrorResponse(error));
  }

  if (error.message.includes("unauthorized") || error.message.includes("forbidden")) {
    return res.status(403).json(createErrorResponse(error));
  }

  if (error.message.includes("authentication required")) {
    return res.status(401).json(createErrorResponse(error));
  }

  if (error.message.includes("already exists") || error.message.includes("already processed")) {
    return res.status(409).json(createErrorResponse(error));
  }

  // Default to 500 for unknown errors
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : error.message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * Eliminates need for try-catch in every route
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create operational error
 */
export function createError(message: string, statusCode: number = 500): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}

/**
 * Not found handler (404)
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/**
 * Type-safe error message extraction
 * Use in catch blocks: catch (error: any) { const msg = getErrorMessage(error); }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}

/**
 * Type guard to check if error is a ZodError
 */
export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError;
}

