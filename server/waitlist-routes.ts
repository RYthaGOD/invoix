
import type { Express } from "express";
import { strictRateLimit, requireWalletOwnership } from "./security";
import { insertWaitlistUserSchema, waitlistUsers } from "@shared/invoice-schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import { EmailService } from "./email-service";
import crypto from "crypto";
import { logger } from "./logger";

const emailService = new EmailService();

// Helper to generate a secure API Key
function generateApiKey(): { key: string; hash: string } {
    const prefix = "sk_live_";
    const randomBytes = crypto.randomBytes(24).toString("hex"); // 48 chars
    const key = `${prefix}${randomBytes}`;

    // Hash using SHA-256 for fast lookup (Unique Index friendly)
    const hash = crypto.createHash("sha256").update(key).digest("hex");

    return { key, hash };
}

export function registerWaitlistRoutes(app: Express): void {

    // POST /api/waitlist/apply - Public
    app.post("/api/waitlist/apply", strictRateLimit, async (req, res) => {
        try {
            const data = insertWaitlistUserSchema.parse(req.body);

            // Check if already exists
            const existing = await db.query.waitlistUsers.findFirst({
                where: eq(waitlistUsers.walletAddress, data.walletAddress)
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: `Application already exists. Status: ${existing.status}`
                });
            }

            // Create
            const [newUser] = await db.insert(waitlistUsers).values({
                ...data,
                status: "pending"
            }).returning();

            // Send confirmation email to dev (optional, skipping for now to reduce spam risk)

            // Notify Admin (optional)
            logger.info(`New application from ${data.email} (${data.projectName})`, "waitlist");

            res.json({ success: true, user: newUser });
        } catch (error: any) {
            logger.error("Waitlist apply error", "waitlist", { error });
            res.status(400).json({ success: false, message: error.message });
        }
    });

    // GET /api/waitlist/status - Public check
    app.get("/api/waitlist/status", async (req, res) => {
        try {
            const wallet = req.query.wallet as string;
            if (!wallet) return res.status(400).json({ message: "Wallet required" });

            const user = await db.query.waitlistUsers.findFirst({
                where: eq(waitlistUsers.walletAddress, wallet),
                columns: {
                    status: true,
                    updatedAt: true,
                    projectName: true
                }
            });

            if (!user) return res.status(404).json({ message: "Not found" });

            res.json({ success: true, status: user.status, project: user.projectName });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });

    // ================= ADMIN ROUTES =================
    // Protected by ADMIN_WALLET check in middleware or here
    // For now, we use a simple header check or environment secret for simplicity in this MVP
    // In production, this should be behind a robust admin auth

    const requireAdmin = (req: any, res: any, next: any) => {
        const adminSecret = req.headers["x-admin-secret"];
        if (!process.env.ADMIN_SECRET_KEY || adminSecret !== process.env.ADMIN_SECRET_KEY) {
            return res.status(403).json({ message: "Admin access denied" });
        }
        next();
    };

    // GET /api/admin/waitlist
    app.get("/api/admin/waitlist", requireAdmin, async (req, res) => {
        try {
            const users = await db.query.waitlistUsers.findMany({
                orderBy: [desc(waitlistUsers.createdAt)],
                limit: 100
            });
            res.json({ success: true, users });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });

    // POST /api/admin/waitlist/:id/approve
    app.post("/api/admin/waitlist/:id/approve", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            // Generate Key
            const { key, hash } = generateApiKey();

            // Update DB
            const [updatedUser] = await db.update(waitlistUsers)
                .set({
                    status: "approved",
                    apiKeyHash: hash,
                    updatedAt: new Date()
                })
                .where(eq(waitlistUsers.id, id))
                .returning();

            if (!updatedUser) return res.status(404).json({ message: "User not found" });

            // Send Email
            const emailResult = await emailService.sendEmail({
                to: updatedUser.email,
                subject: "🎉 You're In! Access Granted to Invoix Developer API",
                html: `
                    <h1>Welcome to Invoix!</h1>
                    <p>Your developer application for <b>${updatedUser.projectName}</b> has been approved.</p>
                    <p>Here is your API Key. <b>Store it safely, you will not see it again!</b></p>
                    <div style="background:#f4f4f5; padding: 15px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
                        ${key}
                    </div>
                    <p>View docs at <a href="https://invoix.io/docs">invoix.io/docs</a></p>
                `
            });

            logger.info(`Approved ${updatedUser.email}. Email sent: ${emailResult.success}`, "waitlist");

            // Return key to admin (optional, useful for manual distribution)
            res.json({ success: true, user: updatedUser, apiKey: key });

        } catch (error: any) {
            logger.error("Approve error", "waitlist", { error });
            res.status(500).json({ message: error.message });
        }
    });

    // POST /api/admin/waitlist/:id/reject
    app.post("/api/admin/waitlist/:id/reject", requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;

            const [updatedUser] = await db.update(waitlistUsers)
                .set({ status: "rejected", updatedAt: new Date() })
                .where(eq(waitlistUsers.id, id))
                .returning();

            if (!updatedUser) return res.status(404).json({ message: "User not found" });

            // Send Rejection Email (Polite)
            await emailService.sendEmail({
                to: updatedUser.email,
                subject: "Update on your Invoix Developer Application",
                html: `
                    <p>Hi there,</p>
                    <p>Thank you for your interest in the Invoix Developer API.</p>
                    <p>Unfortunately, we are unable to approve your application for <b>${updatedUser.projectName}</b> at this time due to high demand.</p>
                    <p>We've added you to our mailing list and will notify you when spots open up.</p>
                `
            });

            res.json({ success: true, message: "User rejected" });

        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    });
}
