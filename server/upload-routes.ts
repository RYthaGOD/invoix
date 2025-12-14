
import type { Express } from "express";
import { strictRateLimit, requireWalletOwnership } from "./security";
import fs from "fs";
import path from "path";
import crypto from "crypto";

export function registerUploadRoutes(app: Express): void {

    // POST /api/upload
    // Body: { fileData: "data:image/png;base64,.....", fileName: "logo.png" }
    app.post("/api/upload", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const { fileData, fileName } = req.body;

            if (!fileData || typeof fileData !== 'string') {
                return res.status(400).json({ success: false, message: "Missing fileData (Base64 string)" });
            }

            // 1. Decode Base64
            // Expect format "data:image/png;base64,iVBORw0KGgo..."
            const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);

            if (!matches || matches.length !== 3) {
                return res.status(400).json({ success: false, message: "Invalid Base64 format" });
            }

            const type = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');

            // 2. Validate Type (Images only)
            if (!type.startsWith('image/')) {
                return res.status(400).json({ success: false, message: "Only images are allowed" });
            }

            // 3. Limit Size (e.g., 2MB)
            // Base64 string length is approx 1.33 * file size
            if (buffer.length > 2 * 1024 * 1024) {
                return res.status(400).json({ success: false, message: "File too large (Max 2MB)" });
            }

            // 4. Generate Unique Filename
            const uploadsDir = path.join(process.cwd(), "uploads");
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir);
            }

            // SECURITY: Force extension based on MIME type to prevent masking execs
            const extMap: Record<string, string> = {
                'image/png': '.png',
                'image/jpeg': '.jpg',
                'image/jpg': '.jpg',
                'image/gif': '.gif',
                'image/svg+xml': '.svg',
                'image/webp': '.webp'
            };

            const ext = extMap[type] || '.bin'; // Default to bin if unknown image type
            if (ext === '.bin') {
                console.warn(`Upload with unknown image type: ${type}`);
            }
            const uniqueName = `${crypto.randomBytes(16).toString('hex')}${ext}`;
            const filePath = path.join(uploadsDir, uniqueName);

            // 5. Write File
            await fs.promises.writeFile(filePath, buffer);

            // 6. Return URL
            const fileUrl = `/uploads/${uniqueName}`;
            res.json({ success: true, url: fileUrl });

        } catch (error: any) {
            console.error("Upload error:", error);
            res.status(500).json({ success: false, message: "Failed to upload file" });
        }
    });
}
