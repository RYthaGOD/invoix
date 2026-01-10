
export interface MarketplaceListing {
    id: string;
    invoiceNumber: string;
    faceValue: string;
    askingPrice: string;
    discountRate: string;
    yieldPercentage: string;
    currency: string;
    riskScore: number;
    riskLevel: string;
    riskFlags: string[];
    sellerCreditScore: number;
    sellerCreditTier: string;
    customerCreditScore: number | null;
    dueDate: string;
    daysUntilDue: number;
    listedAt: string;
    expiresAt: string | null;
    viewCount: number;
    description: string | null;
    sellerTruncated: string;
    isBlind: boolean;
}

export interface MarketplaceStats {
    activeListings: number;
    totalSold: number;
    totalVolume: string;
    averageYield: string;
}

export interface AccessRequest {
    requestId: string;
    listingId: string;
    invoiceNumber: string;
    buyerWallet: string;
    message: string;
    createdAt: string;
    status: 'pending' | 'approved' | 'rejected';
}
