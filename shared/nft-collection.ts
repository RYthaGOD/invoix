/**
 * INVOIX NFT Collection Configuration
 * 
 * Defines all available NFTs in the community collection with:
 * - Rarity tiers with weighted drop rates
 * - Per-rarity supply limits
 * - 1 mint per unique wallet
 */

export interface NFTVariant {
    id: string;
    name: string;
    type: string;
    attack: string;
    image: string; // filename in /uploads
    rarity: "common" | "uncommon" | "rare" | "epic";
    hp: number;
}

export interface RarityConfig {
    rarity: string;
    dropRate: number; // Percentage (0-100)
    maxSupply: number;
    currentMinted: number; // Tracked in DB
}

// NFT Variants in the Collection
export const NFT_COLLECTION: NFTVariant[] = [
    // COMMON - INVOIX Exclusive (50% drop rate, 500 supply) - MOST COMMON
    {
        id: "invoix-exclusive",
        name: "INVOIX Exclusive",
        type: "Genesis",
        attack: "Community",
        image: "invoix-exclusive.jpg",
        rarity: "common",
        hp: 150,
    },

    // UNCOMMON - King Cobra & Alien Tech (25% drop rate, 250 supply)
    {
        id: "king-cobra",
        name: "King Cobra",
        type: "Cyber-Venom",
        attack: "Deception",
        image: "king-cobra.jpg",
        rarity: "uncommon",
        hp: 150,
    },
    {
        id: "alien-tech",
        name: "Alien Tech",
        type: "Cyber-Shinobi",
        attack: "Speed",
        image: "alien-tech.jpg",
        rarity: "uncommon",
        hp: 150,
    },

    // RARE - Koala & Giraffe (15% drop rate, 150 supply)
    {
        id: "invoix-koala",
        name: "INVOIX Koala",
        type: "Cyber-Cute",
        attack: "E-Motion",
        image: "invoix-koala.jpg",
        rarity: "rare",
        hp: 150,
    },
    {
        id: "invoix-giraffe",
        name: "INVOIX Giraffe",
        type: "Cyberherbivore",
        attack: "Data",
        image: "invoix-giraffe.jpg",
        rarity: "rare",
        hp: 150,
    },

    // EPIC - Ant (10% drop rate, 100 supply) - RAREST
    {
        id: "invoix-ant",
        name: "INVOIX Ant",
        type: "Cyber/Insect",
        attack: "Finance",
        image: "invoix-ant.jpg",
        rarity: "epic",
        hp: 150,
    },
];

// Rarity Distribution (must sum to 100%)
export const RARITY_CONFIG: Record<string, RarityConfig> = {
    common: {
        rarity: "common",
        dropRate: 55,    // 55% chance - MOST COMMON (INVOIX Exclusive)
        maxSupply: 550,  // 550 base NFTs
        currentMinted: 0,
    },
    uncommon: {
        rarity: "uncommon",
        dropRate: 25,    // 25% chance (King Cobra, Alien Tech)
        maxSupply: 250,  // 250 uncommon NFTs (125 each)
        currentMinted: 0,
    },
    rare: {
        rarity: "rare",
        dropRate: 15,    // 15% chance (Koala, Giraffe)
        maxSupply: 150,  // 150 rare NFTs (75 each)
        currentMinted: 0,
    },
    epic: {
        rarity: "epic",
        dropRate: 5,     // 5% chance - ULTRA RARE (Ant)
        maxSupply: 50,   // 50 epic NFTs - SUPER LIMITED
        currentMinted: 0,
    },
};

// Total Collection Supply
export const TOTAL_SUPPLY = 1000;
export const MAX_PER_WALLET = 1;

/**
 * Select a random NFT variant based on rarity weights
 * Falls back to next available tier if a rarity is sold out
 */
export function selectRandomNFT(
    mintedCounts: Record<string, number>
): NFTVariant | null {
    // Calculate available rarities
    const availableRarities = Object.entries(RARITY_CONFIG)
        .filter(([rarity, config]) => (mintedCounts[rarity] || 0) < config.maxSupply)
        .map(([rarity, config]) => ({ rarity, weight: config.dropRate }));

    if (availableRarities.length === 0) {
        return null; // All sold out
    }

    // Normalize weights
    const totalWeight = availableRarities.reduce((sum, r) => sum + r.weight, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    let selectedRarity = availableRarities[0].rarity;

    for (const { rarity, weight } of availableRarities) {
        cumulative += weight;
        if (random <= cumulative) {
            selectedRarity = rarity;
            break;
        }
    }

    // Get variants for selected rarity
    const variants = NFT_COLLECTION.filter((nft) => nft.rarity === selectedRarity);

    if (variants.length === 0) {
        return null;
    }

    // Random variant within rarity
    const randomIndex = Math.floor(Math.random() * variants.length);
    return variants[randomIndex];
}

/**
 * Get collection stats
 */
export function getCollectionStats(mintedCounts: Record<string, number>) {
    const totalMinted = Object.values(mintedCounts).reduce((sum, count) => sum + count, 0);

    return {
        totalSupply: TOTAL_SUPPLY,
        totalMinted,
        remaining: TOTAL_SUPPLY - totalMinted,
        byRarity: Object.entries(RARITY_CONFIG).map(([rarity, config]) => ({
            rarity,
            maxSupply: config.maxSupply,
            minted: mintedCounts[rarity] || 0,
            remaining: config.maxSupply - (mintedCounts[rarity] || 0),
            dropRate: config.dropRate,
        })),
    };
}
