
import { Request, Response, NextFunction } from "express";

/**
 * Simple auth middleware to require session authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const walletAddress = (req.session as any)?.walletAddress;

    if (!walletAddress) {
        res.status(401).json({
            success: false,
            error: "Authentication required"
        });
        return;
    }

    next();
}
