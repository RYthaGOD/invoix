import { log } from "./vite";
import { Resend } from "resend";

interface EmailConfig {
    apiKey?: string;
    fromAddress: string;
}

interface InvoiceEmailData {
    to: string;
    invoiceNumber: string;
    amount: string;
    currency: string;
    dueDate: string;
    payLink: string;
    businessName: string;
}

interface PaymentReceiptEmailData {
    to: string;
    invoiceNumber: string;
    amountPaid: string;
    currency: string;
    paymentDate: string;
    transactionSignature: string;
    businessName: string;
}

/**
 * Email Service for Notifications
 * 
 * Uses Resend API for transactional emails.
 * Falls back to logging if no API key is present.
 */
export class EmailService {
    private config: EmailConfig;
    private resend: Resend | null = null;
    private isReady: boolean = false;

    constructor() {
        this.config = {
            apiKey: process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY,
            fromAddress: process.env.EMAIL_FROM_ADDRESS || "notifications@invoix.platform", // Update with your verified domain
        };

        if (this.config.apiKey) {
            try {
                this.resend = new Resend(this.config.apiKey);
                this.isReady = true;
                console.log("📧 Email Service Initialized (Resend API Active)");
            } catch (error) {
                console.error("❌ Failed to initialize Resend:", error);
            }
        } else {
            console.log("⚠️ Email Service Initialized (Log/Mock Mode) - Set RESEND_API_KEY to go live");
        }
    }

    /**
     * Send an invoice notification to a customer
     */
    async sendInvoiceEmail(data: InvoiceEmailData): Promise<boolean> {
        // Validate 'to' address
        if (!data.to || !data.to.includes("@")) {
            console.warn(`[Email] Invalid 'to' address: ${data.to}. Skipping email.`);
            return false;
        }

        // Retry logic with exponential backoff
        const maxRetries = 3;
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                if (this.isReady && this.resend) {
                    return await this.realSend(data);
                } else {
                    return await this.mockSend(data);
                }
            } catch (error: any) {
                lastError = error;
                console.warn(`[Email] Attempt ${attempt}/${maxRetries} failed:`, error.message);

                // Don't retry on non-transient errors
                if (error.statusCode === 400 || error.statusCode === 401) {
                    break;
                }

                if (attempt < maxRetries) {
                    // Exponential backoff: 1s, 2s, 4s
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        console.error("❌ Failed to send email after retries:", lastError);
        return false;
    }

    /**
     * Send a payment receipt notification
     */
    async sendPaymentReceiptEmail(data: PaymentReceiptEmailData): Promise<boolean> {
        if (!data.to || !data.to.includes("@")) {
            console.warn(`[Email] Invalid 'to' address: ${data.to}. Skipping receipt.`);
            return false;
        }

        try {
            if (this.isReady && this.resend) {
                return await this.realSendReceipt(data);
            } else {
                return await this.mockSendReceipt(data);
            }
        } catch (error) {
            console.error("❌ Failed to send receipt email:", error);
            return false;
        }
    }

    /**
     * Internal method to send via Resend
     */
    private async realSend(data: InvoiceEmailData): Promise<boolean> {
        try {
            if (!this.resend) throw new Error("Resend client not initialized");

            // HTML Template for Invoice
            const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Invoice from ${data.businessName}</h2>
          <p>You have received a new invoice.</p>
          
          <div style="background: #f4f4f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
            <p><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
            <p><strong>Due Date:</strong> ${data.dueDate}</p>
          </div>

          <a href="${data.payLink}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View & Pay Invoice
          </a>

          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            Powered by Invoix (Solana B2B Platform)
          </p>
        </div>
      `;

            const { data: resendData, error } = await this.resend.emails.send({
                from: `Invoix <${this.config.fromAddress}>`, // Must be a verified domain in Resend
                to: [data.to],
                subject: `Invoice ${data.invoiceNumber} from ${data.businessName}`,
                html: htmlContent,
            });

            if (error) {
                console.error("Resend API Error:", error);
                return false;
            }

            log(`[Email] Sent successfully to ${data.to} (ID: ${resendData?.id})`);
            return true;

        } catch (error) {
            console.error("Error sending via Resend:", error);
            return false;
        }
    }

    private async realSendReceipt(data: PaymentReceiptEmailData): Promise<boolean> {
        try {
            if (!this.resend) throw new Error("Resend client not initialized");

            const htmlContent = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2>Payment Receipt received from ${data.businessName}</h2>
                  <p>Thank you! Your payment has been successfully recorded.</p>
                  
                  <div style="background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #10b981;">
                    <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
                    <p><strong>Amount Paid:</strong> ${data.amountPaid} ${data.currency}</p>
                    <p><strong>Date:</strong> ${data.paymentDate}</p>
                    <p style="font-size: 12px; word-break: break-all;"><strong>Transaction Signature:</strong> ${data.transactionSignature}</p>
                  </div>

                  <p style="color: #666; font-size: 14px; margin-top: 20px;">
                    Powered by Invoix (Solana B2B Platform)
                  </p>
                </div>
            `;

            const { data: resendData, error } = await this.resend.emails.send({
                from: `Invoix <${this.config.fromAddress}>`,
                to: [data.to],
                subject: `Payment Receipt: Invoice ${data.invoiceNumber}`,
                html: htmlContent,
            });

            if (error) {
                console.error("Resend API Receipt Error:", error);
                return false;
            }

            log(`[Email] Receipt sent successfully to ${data.to}`);
            return true;

        } catch (error) {
            console.error("Error sending receipt via Resend:", error);
            return false;
        }
    }

    /**
     * Mock sender that logs to console
     */
    private async mockSend(data: InvoiceEmailData): Promise<boolean> {
        console.log("\n==================================================");
        console.log("📧 [MOCK EMAIL SERVICE] Sending Email (Set RESEND_API_KEY to enable)");
        console.log("--------------------------------------------------");
        console.log(`To:           ${data.to}`);
        console.log(`From:         ${this.config.fromAddress}`);
        console.log(`Subject:      Invoice ${data.invoiceNumber} from ${data.businessName}`);
        console.log("--------------------------------------------------");
        console.log("Body:");
        console.log(`Hello,`);
        console.log(`You have received a new invoice from ${data.businessName}.`);
        console.log(`Amount: ${data.amount} ${data.currency}`);
        console.log(`Due Date: ${data.dueDate}`);
        console.log(`View & Pay: ${data.payLink}`);
        console.log("--------------------------------------------------");
        console.log("End of Email");
        console.log("==================================================\n");

        // Log to system logger as well
        log(`[Email] Mock sent to ${data.to} for invoice ${data.invoiceNumber}`);

        return true;
    }

    private async mockSendReceipt(data: PaymentReceiptEmailData): Promise<boolean> {
        console.log("\n==================================================");
        console.log("📧 [MOCK EMAIL SERVICE] Sending Payment Receipt");
        console.log("--------------------------------------------------");
        console.log(`To:           ${data.to}`);
        console.log(`Subject:      Receipt for Invoice ${data.invoiceNumber}`);
        console.log("--------------------------------------------------");
        console.log("Body:");
        console.log(`Payment confirmed for ${data.businessName}.`);
        console.log(`Amount: ${data.amountPaid} ${data.currency}`);
        console.log(`Tx: ${data.transactionSignature}`);
        console.log("==================================================\n");
        return true;
    }

    /**
     * Generic send method for arbitrary emails (e.g. Waitlist, Alerts)
     */
    async sendEmail(data: { to: string; subject: string; html: string }): Promise<{ success: boolean; id?: string }> {
        if (!data.to || !data.to.includes("@")) {
            console.warn(`[Email] Invalid 'to' address: ${data.to}`);
            return { success: false };
        }

        try {
            if (this.isReady && this.resend) {
                const { data: resendData, error } = await this.resend.emails.send({
                    from: `Invoix <${this.config.fromAddress}>`,
                    to: [data.to],
                    subject: data.subject,
                    html: data.html,
                });

                if (error) {
                    console.error("Resend API Generic Error:", error);
                    return { success: false };
                }
                return { success: true, id: resendData?.id };

            } else {
                // Mock send
                console.log("\n[MOCK EMAIL] ----------------------------");
                console.log(`To: ${data.to}`);
                console.log(`Subject: ${data.subject}`);
                console.log(`Body (Truncated): ${data.html.substring(0, 50)}...`);
                console.log("-----------------------------------------\n");
                return { success: true, id: "mock-id" };
            }
        } catch (error) {
            console.error("Generic send error:", error);
            return { success: false };
        }
    }
}

// Singleton instance
let emailService: EmailService | null = null;

export function getEmailService(): EmailService {
    if (!emailService) {
        emailService = new EmailService();
    }
    return emailService;
}
