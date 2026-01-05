
import type { Express } from "express";
import { invoiceStorage } from "./invoice-storage";
import { strictRateLimit, requireWalletOwnership } from "./security";
import { getInvoiceNFTService } from "./nft-service";

export function registerNftRoutes(app: Express): void {

    /**
     * Create Mint Invoice Transaction
     * POST /api/nft/mint-invoice/:id
     * 
     * Returns a partially signed transaction (signed by Server/Authority)
     * that the Client/User must sign and submit (paying for gas).
     */
    app.post("/api/nft/mint-invoice/:id", requireWalletOwnership, strictRateLimit, async (req, res) => {
        try {
            const { id } = req.params;
            const walletAddress = req.query.wallet as string;

            // Debug Logging for Mobile "Load Failed" issues
            console.log(`[NFT] Mint Request Received for ${id}`, {
                ip: req.ip,
                userWallet: walletAddress,
                sessionID: req.sessionID,
                hasSession: !!req.session,
                sessionWallet: req.session?.walletAddress,
                headers: {
                    origin: req.headers.origin,
                    userAgent: req.headers['user-agent']
                }
            });

            // 1. Get Invoice
            const invoice = await invoiceStorage.getInvoice(id);
            if (!invoice) {
                return res.status(404).json({ message: "Invoice not found" });
            }

            // 2. Verify Ownership
            if (invoice.invoicerWalletAddress !== walletAddress) {
                return res.status(403).json({ message: "Unauthorized: Only the invoicer can mint the NFT" });
            }

            // 3. Verify not already minted
            if (invoice.nftMint) {
                return res.status(400).json({ message: "Invoice NFT already minted" });
            }

            // 4. Get NFT Service
            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                return res.status(503).json({ message: "NFT Service not initialized on server" });
            }

            // 5. Create Transaction
            // User pays, so we pass their wallet as payer
            const base64Transaction = await nftService.createMintInvoiceTransaction(
                invoice,
                walletAddress
            );

            res.json({
                success: true,
                transaction: base64Transaction,
                message: "Transaction created. Please sign and submit."
            });

        } catch (error: any) {
            console.error("NFT Mint Error:", error);
            res.status(500).json({ message: error.message || "Failed to create mint transaction" });
        }
    });

    /**
     * Callback to Confirm Minting
     * POST /api/nft/confirm-mint/:id
     * 
     * Client calls this after successfully submitting the transaction
     * to update the invoice record with NFT details.
     */
    app.post("/api/nft/confirm-mint/:id", requireWalletOwnership, async (req, res) => {
        try {
            const { id } = req.params;
            const { signature } = req.body;

            if (!signature) {
                return res.status(400).json({ message: "Missing transaction signature" });
            }

            const nftService = getInvoiceNFTService();
            if (!nftService.isReady()) {
                return res.status(503).json({ message: "NFT Service not ready" });
            }

            // 1. Get Authoritative Merkle Tree
            const merkleTreeAddress = nftService.getMerkleTree();

            // 2. Extract Leaf Index from Chain (Verify Transaction)
            // This is authoritative - it proves the mint actually happened on chain
            const leafIndex = await nftService.extractLeafIndexFromTransaction(signature);

            // 3. Derive Asset ID (Mint Address / Asset ID)
            // This is the correct way to get the Compressed NFT address
            const assetId = await nftService.deriveAssetId(leafIndex);

            // Update Invoice with validated data
            await invoiceStorage.updateInvoice(id, {
                nftMint: assetId,
                nftMintedAt: new Date(),
                nftMerkleTree: merkleTreeAddress,
                nftLeafIndex: leafIndex,
            } as any);

            res.json({
                success: true,
                message: "Invoice NFT status updated",
                data: {
                    mint: assetId,
                    merkleTree: merkleTreeAddress,
                    leafIndex
                }
            });

        } catch (error: any) {
            console.error("Confirm Mint Error:", error);
            res.status(500).json({ message: error.message || "Failed to confirm mint" });
        }
    });
}
