import { type Request } from "express";

export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
  DEBUG = "DEBUG",
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  source: string;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
}

/**
 * Structured JSON Logger for Production Observability
 */
export function structuredLog(
  level: LogLevel,
  message: string,
  source: string = "system",
  context?: Record<string, any>,
  req?: Request
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    source,
    message,
    context,
    requestId: req ? (req as any).id || (req.headers["x-request-id"] as string) : undefined,
  };

  // In production, we output raw JSON for log collectors (ELK, Stackdriver, etc.)
  // In development, we keep it readable
  if (process.env.NODE_ENV === "production" || process.env.LOG_JSON === "true") {
    console.log(JSON.stringify(entry));
  } else {
    const color = level === LogLevel.ERROR ? "\x1b[31m" : level === LogLevel.WARN ? "\x1b[33m" : "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(`${entry.timestamp} [${color}${level}${reset}] [${source}] ${message}`, context ? context : "");
  }
}

export const logger = {
  info: (msg: string, source?: string, ctx?: Record<string, any>, req?: Request) =>
    structuredLog(LogLevel.INFO, msg, source, ctx, req),
  warn: (msg: string, source?: string, ctx?: Record<string, any>, req?: Request) =>
    structuredLog(LogLevel.WARN, msg, source, ctx, req),
  error: (msg: string, source?: string, ctx?: Record<string, any>, req?: Request) =>
    structuredLog(LogLevel.ERROR, msg, source, ctx, req),
  debug: (msg: string, source?: string, ctx?: Record<string, any>, req?: Request) =>
    structuredLog(LogLevel.DEBUG, msg, source, ctx, req),
};
