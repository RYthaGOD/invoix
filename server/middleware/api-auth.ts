import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { db } from "../db";
import { waitlistUsers } from "@shared/invoice-schema";
import { eq } from "drizzle-orm";

// Extend Request to include apiUser
declare global {
    namespace Express {
        interface Request {
            apiUser?: typeof waitlistUsers.$inferSelect;
        }
    }
}

export async function validateApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers["x-api-key"] as string;

    if (!apiKey) {
        // If no key, just continue. 
        // The next middleware (requireWalletOwnership) will handle auth if needed.
        return next();
    }

    try {
        // hash the input key
        const hash = crypto.createHash("sha256").update(apiKey).digest("hex");

        // Lookup user by hash
        const user = await db.query.waitlistUsers.findFirst({
            where: eq(waitlistUsers.apiKeyHash, hash)
        });

        if (!user || user.status !== "approved") {
            return res.status(401).json({
                success: false,
                message: "Invalid or inactive API Key"
            });
        }

        // Attach user to request
        req.apiUser = user;

        // Mock Session behavior for backward compatibility with route logic
        // Most routes check req.session.walletAddress
        if (!req.session) {
            // @ts-ignore
            req.session = {};
        }

        // If the route expects a wallet address, provide the Developer's wallet
        if (!req.session.walletAddress) {
            req.session.walletAddress = user.walletAddress;
            // Mark as API session
            // @ts-ignore
            req.session.isApiRequest = true;
        }

        next();
    } catch (error) {
        console.error("API Key Validation Error:", error);
        res.status(500).json({ success: false, message: "Internal Auth Error" });
    }
}
