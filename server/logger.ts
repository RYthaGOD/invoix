/**
 * Structured Logging Utility
 * 
 * Provides JSON-formatted logging with request IDs and context
 */

import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  userId?: string;
  context?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Logger class
 */
export class Logger {
  private context: Record<string, any>;

  constructor(context: Record<string, any> = {}) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, meta: Record<string, any> = {}) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...meta,
    };

    // In production, you might want to send these to a logging service
    // like CloudWatch, Datadog, or Sentry
    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV !== "production") {
          console.log(output);
        }
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, meta);
  }

  info(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.log(LogLevel.WARN, message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    const errorMeta = error ? {
      error: {
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      }
    } : {};

    this.log(LogLevel.ERROR, message, { ...errorMeta, ...meta });
  }

  child(additionalContext: Record<string, any>): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }
}

/**
 * Request ID middleware
 * Adds a unique request ID to each request for tracing
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers["x-request-id"] as string || crypto.randomUUID();
  
  // Attach to request object
  (req as any).requestId = requestId;
  
  // Add to response headers
  res.setHeader("x-request-id", requestId);
  
  next();
}

/**
 * Request logging middleware
 * Logs incoming requests and responses
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = (req as any).requestId;
  const logger = new Logger({ requestId });

  // Log incoming request
  logger.info("Incoming request", {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    
    if (res.statusCode >= 400) {
      logger.warn("Request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    } else {
      logger.info("Request completed", {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });

  // Attach logger to request for use in routes
  (req as any).logger = logger;

  next();
}

/**
 * Get logger from request
 */
export function getLogger(req: Request): Logger {
  return (req as any).logger || new Logger();
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Security event logger
 * For logging authentication attempts, authorization failures, etc.
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  severity: "low" | "medium" | "high" | "critical" = "medium"
) {
  logger.warn(`Security event: ${event}`, {
    event,
    severity,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Business event logger
 * For logging important business operations
 */
export function logBusinessEvent(
  event: string,
  details: Record<string, any>
) {
  logger.info(`Business event: ${event}`, {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
}
