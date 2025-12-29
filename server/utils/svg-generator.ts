import { Invoice, BusinessProfile } from "@shared/invoice-schema";
import { NFTVariant } from "@shared/nft-collection";

interface GenerateSvgOptions {
  logoData?: string;
  isReceipt?: boolean;
}

/**
 * 8K Premium 3D Glass SVG Engine
 * Generates photorealistic glassmorphism assets using advanced SVG filters.
 */
export function generateInvoiceSvg(invoice: Invoice, business?: BusinessProfile, options: GenerateSvgOptions = {}): string {
  // Ultra-HD Base Resolution
  const width = 1200;
  const height = 1200; // Square aspect for NFT marketplaces

  const status = invoice.status.toUpperCase();
  const isPaid = status === 'PAID';
  const isReceipt = options.isReceipt || isPaid;
  const title = isReceipt ? "PAYMENT RECEIPT" : "INVOICE";

  // Design Tokens - Midnight Prism Palette
  const colors = {
    bg: "#020617", // Slate-950
    glass: "rgba(255, 255, 255, 0.03)",
    glassBorder: "rgba(255, 255, 255, 0.15)",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.6)",
    accent: business?.brandColor || "#3b82f6", // Default Blue-500
    success: "#10b981",
    danger: "#ef4444"
  };

  // formatting
  const amount = new Intl.NumberFormat('en-US', { style: 'currency', currency: invoice.currency }).format(Number(invoice.totalAmount));
  const date = new Date(invoice.invoiceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const dueDate = new Date(invoice.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  // Logo
  let logoContent = "";
  if (options.logoData) {
    logoContent = `<image x="0" y="0" width="80" height="80" href="${options.logoData}" preserveAspectRatio="xMidYMid meet" style="filter: url(#glow)" />`;
  } else {
    logoContent = `
       <rect width="80" height="80" rx="20" fill="url(#accentGradient)" style="filter: url(#glow)" />
       <text x="40" y="55" font-family="'Inter', sans-serif" font-size="40" text-anchor="middle" fill="white" font-weight="bold">${(business?.businessName || "I").charAt(0)}</text>
     `;
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <!-- FONTS -->
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
          .text-lg { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600; }
          .text-sm { font-family: 'Inter', sans-serif; font-size: 18px; font-weight: 400; }
          .text-h1 { font-family: 'Inter', sans-serif; font-size: 64px; font-weight: 800; letter-spacing: -2px; }
          .label { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; }
          .mono { font-family: 'Courier New', monospace; font-size: 16px; letter-spacing: 1px; }
        </style>

        <!-- GRADIENTS -->
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="50%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>

        <linearGradient id="cardGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgba(255, 255, 255, 0.1)"/>
          <stop offset="100%" stop-color="rgba(255, 255, 255, 0.02)"/>
        </linearGradient>

        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${colors.accent}"/>
          <stop offset="100%" stop-color="#60a5fa"/>
        </linearGradient>

        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
           <stop offset="0%" stop-color="rgba(255,255,255,0)" />
           <stop offset="50%" stop-color="rgba(255,255,255,0.1)" />
           <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>

        <!-- ADVANCED FILTERS -->
        
        <!-- Glass Frosted Effect -->
        <filter id="glassBlur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="20" result="blur"/>
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop"/>
        </filter>

        <!-- Specular Lighting (Glossy Edges) -->
        <filter id="specular" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="1" in="SourceAlpha" result="blur"/> 
          <feSpecularLighting surfaceScale="2" specularConstant="1" specularExponent="20" lighting-color="#ffffff" in="blur" result="specular">
            <fePointLight x="-5000" y="-10000" z="20000"/>
          </feSpecularLighting>
          <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular"/>
        </filter>

        <!-- Deep Drop Shadow -->
        <filter id="dropShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="30" result="blur"/>
          <feOffset in="blur" dx="20" dy="40" result="offsetBlur"/>
          <feFlood flood-color="black" flood-opacity="0.5" result="flood"/>
          <feComposite in="flood" in2="offsetBlur" operator="in" result="shadow"/>
          <feMerge>
            <feMergeNode in="shadow"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

        <!-- Neon Glow -->
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>

      </defs>

      <!-- BACKGROUND -->
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      
      <!-- Ambient Orbs -->
      <circle cx="200" cy="200" r="400" fill="${colors.accent}" opacity="0.1" filter="url(#glassBlur)"/>
      <circle cx="1000" cy="1000" r="300" fill="#purple" opacity="0.1" filter="url(#glassBlur)"/>

      <!-- 3D CARD CONTAINER -->
      <g transform="translate(150, 200)">
        
        <!-- Glass Card Platform -->
        <rect x="0" y="0" width="900" height="800" rx="40" 
              fill="url(#cardGradient)" 
              stroke="${colors.glassBorder}" 
              stroke-width="2" 
              filter="url(#dropShadow)"/>
        
        <!-- Glossy Overlay -->
        <rect x="0" y="0" width="900" height="800" rx="40" fill="white" opacity="0" filter="url(#specular)"/>
        
        <!-- CARD CONTENT -->
        <g transform="translate(60, 60)">
          
          <!-- Header Area -->
          <g>
             ${logoContent}
             <text x="780" y="40" fill="${colors.textSecondary}" text-anchor="end" class="label">${title}</text>
             <text x="780" y="70" fill="${colors.textPrimary}" text-anchor="end" class="mono">#${invoice.invoiceNumber}</text>
          </g>

          <!-- Main Amount -->
          <g transform="translate(0, 200)">
             <text fill="${colors.textSecondary}" class="label">TOTAL AMOUNT</text>
             <text y="70" fill="${colors.textPrimary}" class="text-h1" filter="url(#glow)">${amount}</text>
             <rect y="90" width="80" height="4" fill="url(#accentGradient)" rx="2"/>
          </g>

          <!-- Details Grid -->
          <g transform="translate(0, 400)">
             <!-- From -->
             <g>
                <text fill="${colors.textSecondary}" class="label">ISSUED BY</text>
                <text y="35" fill="${colors.textPrimary}" class="text-lg">${business?.businessName || "Unknown Business"}</text>
             </g>
             
             <!-- To -->
             <g transform="translate(450, 0)">
                <text fill="${colors.textSecondary}" class="label">ISSUED TO</text>
                <text y="35" fill="${colors.textPrimary}" class="text-lg">${invoice.invoiceeWalletAddress.slice(0, 6)}...${invoice.invoiceeWalletAddress.slice(-4)}</text>
             </g>

             <!-- Dates -->
             <g transform="translate(0, 120)">
                <text fill="${colors.textSecondary}" class="label">ISSUED DATE</text>
                <text y="35" fill="${colors.textPrimary}" class="text-lg">${date}</text>
             </g>

             <g transform="translate(450, 120)">
                <text fill="${colors.textSecondary}" class="label">DUE DATE</text>
                <text y="35" fill="${colors.textPrimary}" class="text-lg">${dueDate}</text>
             </g>
          </g>
          
          <!-- Bottom Bar -->
          <g transform="translate(0, 640)">
             <path d="M0,0 L780,0" stroke="${colors.glassBorder}" stroke-width="2" stroke-dasharray="8 8"/>
             <text y="40" fill="${colors.textSecondary}" class="mono" font-size="12">
                Hash: ${invoice.id.split('-')[0]}••••••••${invoice.id.split('-')[4]}
             </text>
             <text x="780" y="40" text-anchor="end" fill="url(#accentGradient)" class="text-sm font-bold">
                VERIFIED ON SOLANA
             </text>
          </g>

        </g> 
      </g>

      <!-- STAMP OVERLAY -->
      ${isPaid ? `
      <g transform="translate(750, 150) rotate(-15)">
        <rect x="0" y="0" width="300" height="120" rx="20" stroke="${colors.success}" stroke-width="12" fill="rgba(16, 185, 129, 0.1)" />
        <text x="150" y="80" font-family="'Inter', sans-serif" font-size="70" font-weight="900" fill="${colors.success}" text-anchor="middle" letter-spacing="4">PAID</text>
        <rect x="0" y="0" width="300" height="120" rx="20" stroke="white" stroke-width="2" stroke-opacity="0.5" filter="url(#glow)"/>
      </g>
      ` : ''}

    </svg>
  `;
}

/**
 * 8K Private Invoice Placeholder (3D Lock)
 */
export function generatePrivateInvoiceSvg(invoiceId: string): string {
  const width = 1200;
  const height = 1200;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#020617"/>
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="15" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <rect width="100%" height="100%" fill="url(#bgGradient)"/>
      
      <!-- Central Lock Icon -->
      <g transform="translate(600, 600)" fill="#64748b">
         <circle cx="0" cy="0" r="150" fill="#1e293b" stroke="#334155" stroke-width="4"/>
         <rect x="-60" y="-30" width="120" height="100" rx="10" fill="#94a3b8" filter="url(#glow)"/>
         <path d="M-40 -30 V -70 A 40 40 0 0 1 40 -70 V -30" stroke="#94a3b8" stroke-width="20" fill="none" />
         <circle cx="0" cy="20" r="15" fill="#0f172a" />
      </g>
      
      <text x="600" y="850" font-family="sans-serif" font-size="40" fill="#64748b" text-anchor="middle" font-weight="bold">CONFIDENTIAL COMPUTING</text>
      <text x="600" y="900" font-family="monospace" font-size="24" fill="#475569" text-anchor="middle">Arcium TEE Encrypted</text>
    </svg>
  `;
}

/**
 * 8K Holographic Trading Card Generator (Community Drops)
 * Wraps the character art in a premium 3D Game Card frame.
 */
export function generateTradingCardSvg(nft: NFTVariant, imageData?: string): string {
  const width = 1200;
  const height = 1600; // Portrait aspect for trading cards

  // Rarity Colors
  const rarityColors: Record<string, string> = {
    common: "#94a3b8", // Slate
    uncommon: "#10b981", // Emerald
    rare: "#3b82f6", // Blue
    epic: "#a855f7", // Purple
    legendary: "#eab308" // Gold
  };

  const color = rarityColors[nft.rarity] || rarityColors.common;

  // Character Image (centered in frame)
  let imageContent = "";
  if (imageData) {
    imageContent = `<image x="100" y="200" width="1000" height="1000" href="${imageData}" preserveAspectRatio="xMidYMid slice" clip-path="url(#frameClip)"/>`;
  } else {
    // Fallback if image load fails
    imageContent = `<rect x="100" y="200" width="1000" height="1000" fill="#1e293b" clip-path="url(#frameClip)"/>
                         <text x="600" y="700" text-anchor="middle" fill="white" font-size="50">IMAGE LOADING...</text>`;
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@400;600&display=swap');
          .title { font-family: 'Orbitron', sans-serif; font-weight: 900; font-size: 80px; text-transform: uppercase; }
          .stat-label { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 30px; letter-spacing: 2px; }
          .stat-value { font-family: 'Orbitron', sans-serif; font-weight: 700; font-size: 50px; }
          .type { font-family: 'Inter', sans-serif; font-weight: 400; font-size: 40px; text-transform: uppercase; letter-spacing: 4px;}
          
          /* 8K Premium Animations */
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes glow-pulse {
            0%, 100% { filter: drop-shadow(0 0 10px ${color}); opacity: 1; }
            50% { filter: drop-shadow(0 0 25px ${color}); opacity: 0.9; }
          }
          @keyframes holographic-shift {
            0% { fill-opacity: 0.1; }
            50% { fill-opacity: 0.25; }
            100% { fill-opacity: 0.1; }
          }
          @keyframes border-glow {
            0%, 100% { stroke-opacity: 1; }
            50% { stroke-opacity: 0.7; }
          }
          .shimmer-bar { animation: shimmer 3s ease-in-out infinite; }
          .glow-text { animation: glow-pulse 2s ease-in-out infinite; }
          .holo-overlay { animation: holographic-shift 4s ease-in-out infinite; }
          .border-animate { animation: border-glow 2s ease-in-out infinite; }
        </style>

        <!-- Filters -->
        <filter id="hologram">
            <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="3" result="noise"/>
            <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0" in="noise" result="coloredNoise"/>
            <feComposite operator="in" in="coloredNoise" in2="SourceGraphic" result="composite"/>
            <feBlend mode="screen" in="composite" in2="SourceGraphic"/>
        </filter>

        <linearGradient id="frameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#334155"/>
            <stop offset="50%" stop-color="#0f172a"/>
            <stop offset="100%" stop-color="#334155"/>
        </linearGradient>

        <linearGradient id="borderGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${color}"/>
            <stop offset="50%" stop-color="white"/>
            <stop offset="100%" stop-color="${color}"/>
        </linearGradient>

        <clipPath id="frameClip">
            <rect x="100" y="200" width="1000" height="1000" rx="40" />
        </clipPath>
      </defs>

      <!-- CARD BODY -->
      <rect width="100%" height="100%" fill="#020617"/>
      
      <!-- Frame Border with Animation -->
      <rect x="50" y="50" width="1100" height="1500" rx="60" fill="url(#frameGradient)" stroke="url(#borderGradient)" stroke-width="15" class="border-animate"/>

      <!-- Character Art -->
      ${imageContent}

      <!-- Holographic Overlay on Art with Animation -->
      <rect x="100" y="200" width="1000" height="1000" rx="40" fill="url(#shimmer)" style="mix-blend-mode: overlay; pointer-events: none;" class="holo-overlay"/>

      <!-- HUD / UI Overlay -->
      <g transform="translate(0, 0)">
         <!-- Title Bar -->
         <path d="M50 1200 L1150 1200 L1150 1450 L50 1450 Z" fill="#0f172a" fill-opacity="0.9" stroke="${color}" stroke-width="4"/>
         
         <text x="600" y="1300" text-anchor="middle" fill="white" class="title glow-text">${nft.name}</text>
         <text x="600" y="1360" text-anchor="middle" fill="${color}" class="type">${nft.type}</text>
      </g>

      <!-- Stats Grid -->
      <g transform="translate(100, 1400)">
          <!-- HP -->
          <g>
             <rect width="300" height="100" fill="#1e293b" rx="10" stroke="#334155" />
             <text x="150" y="40" text-anchor="middle" fill="#94a3b8" class="stat-label">HP</text>
             <text x="150" y="85" text-anchor="middle" fill="#10b981" class="stat-value">${nft.hp}</text>
          </g>

          <!-- Attack -->
          <g transform="translate(350, 0)">
             <rect width="300" height="100" fill="#1e293b" rx="10" stroke="#334155" />
             <text x="150" y="40" text-anchor="middle" fill="#94a3b8" class="stat-label">ATTACK</text>
             <text x="150" y="85" text-anchor="middle" fill="#ef4444" class="stat-value">${nft.attack}</text>
          </g>

          <!-- Rarity -->
          <g transform="translate(700, 0)">
             <rect width="300" height="100" fill="#1e293b" rx="10" stroke="#334155" />
             <text x="150" y="40" text-anchor="middle" fill="#94a3b8" class="stat-label">RARITY</text>
             <text x="150" y="85" text-anchor="middle" fill="${color}" class="stat-value" style="font-size: 40px">${nft.rarity.toUpperCase()}</text>
          </g>
      </g>

      <!-- Top Badge -->
      <circle cx="1050" cy="150" r="60" fill="${color}" stroke="white" stroke-width="5"/>
      <text x="1050" y="170" text-anchor="middle" fill="white" font-weight="900" font-size="60" font-family="sans-serif">8K</text>

    </svg>
    `;
}
