/**
 * Stablecoin Configuration
 * Supported stablecoins for B2B invoicing
 */

// Token Program IDs
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface StablecoinConfig {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    icon: string;
    network: 'mainnet-beta' | 'devnet';
    tokenProgramId: string; // Which token program owns this mint
}

// Mainnet Stablecoin Mints
export const STABLECOINS: Record<string, StablecoinConfig> = {
    SOL: {
        symbol: 'SOL',
        name: 'Solana',
        mint: 'So11111111111111111111111111111111111111112', // Native SOL wrapped mint
        decimals: 9,
        icon: '◎',
        network: 'mainnet-beta',
        tokenProgramId: TOKEN_PROGRAM_ID, // Native SOL uses standard token program
    },
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        icon: '💵',
        network: 'mainnet-beta',
        tokenProgramId: TOKEN_PROGRAM_ID,
    },
    USDT: {
        symbol: 'USDT',
        name: 'Tether USD',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        icon: '💲',
        network: 'mainnet-beta',
        tokenProgramId: TOKEN_PROGRAM_ID,
    },
    PYUSD: {
        symbol: 'PYUSD',
        name: 'PayPal USD',
        mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
        decimals: 6,
        icon: '🅿️',
        network: 'mainnet-beta',
        tokenProgramId: TOKEN_2022_PROGRAM_ID, // PYUSD is Token-2022
    },
    EURC: {
        symbol: 'EURC',
        name: 'Euro Coin',
        mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
        decimals: 6,
        icon: '💶',
        network: 'mainnet-beta',
        tokenProgramId: TOKEN_PROGRAM_ID,
    },
};

// Devnet Test Tokens (for development)
// FIX: Added SOL and other currencies for devnet compatibility
export const DEVNET_STABLECOINS: Record<string, StablecoinConfig> = {
    SOL: {
        symbol: 'SOL',
        name: 'Solana (Devnet)',
        mint: 'So11111111111111111111111111111111111111112', // Same wrapped SOL mint
        decimals: 9,
        icon: '◎',
        network: 'devnet',
        tokenProgramId: TOKEN_PROGRAM_ID,
    },
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin (Devnet)',
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC - This is a Token-2022 token!
        decimals: 6,
        icon: '💵',
        network: 'devnet',
        tokenProgramId: TOKEN_2022_PROGRAM_ID, // Devnet USDC is Token-2022
    },
};

// Get stablecoin config based on environment
export function getStablecoinConfig(symbol: string): StablecoinConfig | undefined {
    const isDevnet = process.env.SOLANA_NETWORK === 'devnet';
    const configs = isDevnet ? DEVNET_STABLECOINS : STABLECOINS;
    return configs[symbol];
}

// Get all available stablecoins for current environment
export function getAvailableStablecoins(): StablecoinConfig[] {
    const isDevnet = process.env.SOLANA_NETWORK === 'devnet';
    const configs = isDevnet ? DEVNET_STABLECOINS : STABLECOINS;
    return Object.values(configs);
}

// Validate if a mint address is a supported stablecoin
export function isValidStablecoin(mintAddress: string): boolean {
    const isDevnet = process.env.SOLANA_NETWORK === 'devnet';
    const configs = isDevnet ? DEVNET_STABLECOINS : STABLECOINS;
    return Object.values(configs).some(config => config.mint === mintAddress);
}

// Get stablecoin by mint address
export function getStablecoinByMint(mintAddress: string): StablecoinConfig | undefined {
    const isDevnet = process.env.SOLANA_NETWORK === 'devnet';
    const configs = isDevnet ? DEVNET_STABLECOINS : STABLECOINS;
    return Object.values(configs).find(config => config.mint === mintAddress);
}
