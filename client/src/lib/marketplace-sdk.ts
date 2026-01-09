/**
 * Marketplace SDK
 * 
 * Client-side SDK for interacting with the Invoice Marketplace API
 */


export interface MarketplaceListing {
    id: string;
    invoiceNumber: string;
    faceValue: string;
    askingPrice: string;
    discountRate: string;
    yieldPercentage: string;
    currency: string;
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'very_high';
    riskFlags: string[];
    sellerCreditScore?: number;
    sellerCreditTier?: string;
    customerCreditScore?: number;
    dueDate: string;
    daysUntilDue: number;
    listedAt: string;
    expiresAt?: string | null;
    viewCount: number;
    description?: string;
    sellerTruncated: string;
}

export interface ListInvoiceRequest {
    invoiceId: string;
    askingPrice: string;
    description?: string;
    expiresInDays?: number;
}

export interface ListInvoiceResponse {
    success: boolean;
    message: string;
    transaction: string; // Base64 transaction to sign
    listing: {
        id: string;
        status: string;
    };
}

/**
 * Fetch active marketplace listings
 */
export async function getMarketplaceListings(params?: {
    currency?: string;
    riskLevel?: string;
    minYield?: number;
    maxPrice?: string;
    sortBy?: 'listedAt' | 'price' | 'yield' | 'risk';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
}): Promise<{ success: boolean; listings: MarketplaceListing[]; count: number; hasMore: boolean }> {
    const searchParams = new URLSearchParams();

    if (params) {
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                searchParams.append(key, String(value));
            }
        });
    }

    const response = await fetch(`/api/marketplace/listings?${searchParams}`);
    if (!response.ok) throw new Error('Failed to fetch marketplace listings');
    return response.json();
}

/**
 * Get details for a specific listing
 */
export async function getListingDetails(listingId: string): Promise<{
    success: boolean;
    listing: MarketplaceListing & {
        invoiceId: string;
        nftMint: string;
        seller: string;
        invoicee: string;
        status: string;
    };
}> {
    const response = await fetch(`/api/marketplace/listings/${listingId}`);
    if (!response.ok) throw new Error('Failed to fetch listing details');
    return response.json();
}

/**
 * List an invoice for sale on the marketplace
 * Returns a transaction that needs to be signed by the wallet
 */
export async function listInvoice(request: ListInvoiceRequest): Promise<ListInvoiceResponse> {
    const response = await fetch('/api/marketplace/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to list invoice');
    }

    return response.json();
}

/**
 * Cancel a marketplace listing
 */
export async function cancelListing(listingId: string): Promise<{
    success: boolean;
    message: string;
    transaction: string; // Base64 transaction to return NFT from escrow
}> {
    const response = await fetch(`/api/marketplace/listings/${listingId}?returnTransaction=true`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel listing');
    }

    return response.json();
}

/**
 * Generate purchase transaction for a listing
 */
export async function purchaseListing(listingId: string): Promise<{
    success: boolean;
    transaction: string; // Base64 transaction
    message: string;
}> {
    const response = await fetch('/api/marketplace/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate purchase transaction');
    }

    return response.json();
}

/**
 * Confirm purchase after successful on-chain transaction
 */
export async function confirmPurchase(listingId: string, signature: string): Promise<{
    success: boolean;
    message: string;
}> {
    const response = await fetch('/api/marketplace/confirm-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, signature }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm purchase');
    }

    return response.json();
}

/**
 * Get current user's listings
 */
export async function getMyListings(): Promise<{
    success: boolean;
    listings: Array<{
        id: string;
        invoiceNumber: string;
        faceValue: string;
        askingPrice: string;
        yieldPercentage: string;
        currency: string;
        status: string;
        riskLevel: string;
        listedAt: string;
        soldAt?: string;
        viewCount: number;
    }>;
    count: number;
}> {
    const response = await fetch('/api/marketplace/my-listings');
    if (!response.ok) throw new Error('Failed to fetch your listings');
    return response.json();
}

/**
 * Get current user's investments
 */
export async function getMyInvestments(): Promise<{
    success: boolean;
    investments: Array<{
        id: string;
        invoiceNumber: string;
        faceValue: string;
        purchasePrice: string;
        expectedYield: string;
        currency: string;
        invoiceStatus: string;
        dueDate: string;
        purchasedAt: string;
        settledAt?: string;
        settlementAmount?: string;
    }>;
    count: number;
}> {
    const response = await fetch('/api/marketplace/my-investments');
    if (!response.ok) throw new Error('Failed to fetch your investments');
    return response.json();
}

/**
 * Get marketplace statistics
 */
export async function getMarketplaceStats(): Promise<{
    success: boolean;
    activeListings: number;
    totalVolumeSold: string;
    averageYield: string;
}> {
    const response = await fetch('/api/marketplace/stats');
    if (!response.ok) throw new Error('Failed to fetch marketplace stats');
    return response.json();
}
