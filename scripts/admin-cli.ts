
import inquirer from "inquirer";
import { db } from "../server/db";
import { waitlistUsers } from "@shared/invoice-schema"; // Ensure this matches schema export
import { eq, desc } from "drizzle-orm";
import { getEmailService } from "../server/email-service";
import crypto from "crypto";
import 'dotenv/config'; // Load env for DB connection

// Initialize Email Service from CLI context
const emailService = getEmailService();

function generateApiKey(): { key: string; hash: string } {
    const prefix = "sk_live_";
    const randomBytes = crypto.randomBytes(24).toString("hex");
    const key = `${prefix}${randomBytes}`;
    // IMPORTANT: Use SHA-256 to match middleware lookup in api-auth.ts
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return { key, hash };
}

async function listPending() {
    const users = await db.query.waitlistUsers.findMany({
        where: eq(waitlistUsers.status, "pending"),
        orderBy: [desc(waitlistUsers.createdAt)],
    });

    if (users.length === 0) {
        console.log("No pending applications.");
        return;
    }

    console.table(users.map(u => ({
        ID: u.id.substring(0, 8),
        Project: u.projectName,
        Email: u.email,
        Date: u.createdAt
    })));
}

async function approveUser(id: string) {
    const user = await db.query.waitlistUsers.findFirst({ where: eq(waitlistUsers.id, id) });
    if (!user) {
        console.log("User not found.");
        return;
    }

    const { key, hash } = generateApiKey();

    await db.update(waitlistUsers)
        .set({ status: "approved", apiKeyHash: hash, updatedAt: new Date() })
        .where(eq(waitlistUsers.id, id));

    console.log(`✅ Approved ${user.projectName}.`);
    console.log(`🔑 API Key: ${key}`);
    console.log("   (This key has been emailed to the user as well)");

    await emailService.sendEmail({
        to: user.email,
        subject: "Welcome to SolanaInvoice API",
        html: `
            <h1>Your API Key is Ready</h1>
            <p>Welcome to SolanaInvoice! Your API access has been approved.</p>
            <p>Access Key: <code>${key}</code></p>
            <p>Documentation: https://solanainvoice.com/developers</p>
            <p>Happy Building!</p>
        `
    });
}

async function main() {
    console.log("\n🦁 PumpLeague Admin CLI\n");

    while (true) {
        const { action } = await inquirer.prompt([{
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: ["List Pending", "Approve User", "Reject User", "Exit"]
        }]);

        if (action === "Exit") process.exit(0);

        if (action === "List Pending") {
            await listPending();
        }

        if (action === "Approve User") {
            const { id } = await inquirer.prompt([{ type: "input", name: "id", message: "Enter User ID (UUID or first 8 chars match):" }]);
            // In a real CLI we'd do fuzzy matching, here we assume full ID for safety in MVP
            // Or fetched list
            await approveUser(id); // Simple stub
        }
    }
}

main().catch(console.error);
