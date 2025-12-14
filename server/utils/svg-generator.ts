
import { Invoice, BusinessProfile } from "@shared/invoice-schema";

interface GenerateSvgOptions {
  logoData?: string; // Base64 encoded logo with data URI prefix or raw base64
  isReceipt?: boolean;
}

/**
 * Generates a dynamic SVG for an Invoice or Receipt.
 * Embeds logo directly as Base64 for maximum compatibility.
 */
export function generateInvoiceSvg(invoice: Invoice, business?: BusinessProfile, options: GenerateSvgOptions = {}): string {
  const width = 800;
  const height = 600;

  const status = invoice.status.toUpperCase();
  const isPaid = status === 'PAID';
  const isReceipt = options.isReceipt || isPaid;

  // Colors
  const bg = "#ffffff";
  const textPrimary = "#111827";
  const textSecondary = "#6b7280";
  const accent = business?.brandColor || "#3b82f6";
  const border = "#e5e7eb";

  // Data
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(invoice.totalAmount));
  const date = new Date(invoice.invoiceDate).toLocaleDateString();
  const dueDate = new Date(invoice.dueDate).toLocaleDateString();
  const invoiceNum = invoice.invoiceNumber;
  const bizName = business?.businessName || "B2B Solana Invoicer";

  // Logo Processing
  let logoSvg = "";
  if (options.logoData) {
    // Ensure it's a valid href for image
    // If it's just base64, prepend header. If it's a URL, leave it (though plan says base64 pref).
    // Assuming receiving full data URI: "data:image/png;base64,..."
    logoSvg = `<image x="40" y="40" width="100" height="100" href="${options.logoData}" preserveAspectRatio="xMidYMid meet" />`;
  } else {
    // Placeholder Logo
    logoSvg = `
      <rect x="40" y="40" width="80" height="80" rx="12" fill="${accent}" fill-opacity="0.1"/>
      <text x="80" y="95" font-family="sans-serif" font-size="40" text-anchor="middle" fill="${accent}" font-weight="bold">${bizName.charAt(0)}</text>
      `;
  }

  // Stamp
  let stampSvg = "";
  if (isPaid || isReceipt) {
    stampSvg = `
      <g transform="translate(550, 40) rotate(-15)">
        <rect x="0" y="0" width="200" height="80" rx="10" stroke="#16a34a" stroke-width="8" fill="none" opacity="0.8"/>
        <text x="100" y="55" font-family="Courier, monospace" font-size="50" font-weight="bold" fill="#16a34a" text-anchor="middle" opacity="0.8">PAID</text>
      </g>
      `;
  }

  // Receipt Header if applicable
  const title = isReceipt ? "PAYMENT RECEIPT" : "INVOICE";

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${bg}"/>
      <rect x="0" y="0" width="100%" height="20" fill="${accent}"/>

      <!-- Logo -->
      ${logoSvg}

      <!-- Header -->
      <text x="${width - 40}" y="80" font-family="sans-serif" font-size="24" font-weight="bold" fill="${textPrimary}" text-anchor="end">${title}</text>
      <text x="${width - 40}" y="110" font-family="sans-serif" font-size="16" fill="${textSecondary}" text-anchor="end">#${invoiceNum}</text>

      <!-- Amount -->
      <g transform="translate(40, 200)">
         <text font-family="sans-serif" font-size="14" fill="${textSecondary}">AMOUNT DUE</text>
         <text y="40" font-family="sans-serif" font-size="48" font-weight="bold" fill="${textPrimary}">${amount}</text>
      </g>

      <!-- Details Grid -->
      <g transform="translate(40, 320)">
         <!-- Row 1 -->
         <text font-family="sans-serif" font-size="14" fill="${textSecondary}">ISSUED TO</text>
         <text y="25" font-family="sans-serif" font-size="18" fill="${textPrimary}">${invoice.invoiceeWalletAddress.slice(0, 6)}...${invoice.invoiceeWalletAddress.slice(-4)}</text>

         <text x="400" font-family="sans-serif" font-size="14" fill="${textSecondary}">DATE</text>
         <text x="400" y="25" font-family="sans-serif" font-size="18" fill="${textPrimary}">${date}</text>

         <!-- Row 2 -->
         <text y="80" font-family="sans-serif" font-size="14" fill="${textSecondary}">ISSUED BY</text>
         <text y="105" font-family="sans-serif" font-size="18" fill="${textPrimary}">${bizName}</text>
         
         <text x="400" y="80" font-family="sans-serif" font-size="14" fill="${textSecondary}">DUE DATE</text>
         <text x="400" y="105" font-family="sans-serif" font-size="18" fill="${textPrimary}">${dueDate}</text>
      </g>

      <!-- Item Count Summary -->
      <line x1="40" y1="480" x2="${width - 40}" y2="480" stroke="${border}" stroke-width="1"/>
      <text x="40" y="520" font-family="sans-serif" font-size="14" fill="${textSecondary}">Payment via Solana (USDC/USDT)</text>
      
      <!-- Footer -->
       <text x="${width / 2}" y="${height - 20}" font-family="sans-serif" font-size="12" fill="${textSecondary}" text-anchor="middle">Powered by B2B Invoix • Blockchain Verified</text>

      <!-- Stamp -->
      ${stampSvg}
    </svg>
  `;
}

/**
 * Generates a privacy-safe placeholder SVG for encrypted invoices
 */
export function generatePrivateInvoiceSvg(invoiceId: string): string {
  const width = 800;
  const height = 600;
  const bg = "#f3f4f6"; // Gray-100
  const textPrimary = "#111827";
  const textSecondary = "#6b7280";

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="100%" height="100%" fill="${bg}"/>
      
      <!-- Lock Icon (Simple Representation) -->
      <g transform="translate(350, 200)">
        <rect x="10" y="60" width="80" height="70" rx="8" fill="#9ca3af" />
        <path d="M20 60 V 30 A 30 30 0 0 1 80 30 V 60" stroke="#9ca3af" stroke-width="12" fill="none" />
        <circle cx="50" cy="95" r="8" fill="#ffffff" />
      </g>

      <!-- Text -->
      <text x="${width / 2}" y="420" font-family="sans-serif" font-size="32" font-weight="bold" fill="${textPrimary}" text-anchor="middle">Private Invoice</text>
      <text x="${width / 2}" y="470" font-family="sans-serif" font-size="18" fill="${textSecondary}" text-anchor="middle">Details Encrypted On-Chain</text>
      <text x="${width / 2}" y="500" font-family="sans-serif" font-size="14" fill="${textSecondary}" text-anchor="middle">#${invoiceId.slice(0, 8)}...</text>
    </svg>
    `;
}
