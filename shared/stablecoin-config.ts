/**
 * Stablecoin Configuration
 * Supported stablecoins for B2B invoicing
 */



export interface StablecoinConfig {
    symbol: string;
    name: string;
    mint: string;
    decimals: number;
    icon: string;
    network: 'mainnet-beta' | 'devnet';
}

// Mainnet Stablecoin Mints
export const STABLECOINS: Record<string, StablecoinConfig> = {
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        decimals: 6,
        icon: '💵',
        network: 'mainnet-beta',
    },
    USDT: {
        symbol: 'USDT',
        name: 'Tether USD',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
        decimals: 6,
        icon: '💲',
        network: 'mainnet-beta',
    },
    PYUSD: {
        symbol: 'PYUSD',
        name: 'PayPal USD',
        mint: '2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo',
        decimals: 6,
        icon: '🅿️',
        network: 'mainnet-beta',
    },
    EURC: {
        symbol: 'EURC',
        name: 'Euro Coin',
        mint: 'HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr',
        decimals: 6,
        icon: '💶',
        network: 'mainnet-beta',
    },
};

// Devnet Test Tokens (for development)
export const DEVNET_STABLECOINS: Record<string, StablecoinConfig> = {
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin (Devnet)',
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // Devnet USDC
        decimals: 6,
        icon: '💵',
        network: 'devnet',
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
