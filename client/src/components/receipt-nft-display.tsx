import React, { useEffect, useState } from "react";
import { Loader2, ExternalLink, CheckCircle } from "lucide-react";
import { NftExplorerLink } from "./nft-explorer-link";

interface ReceiptNFTDisplayProps {
    invoiceId: string;
    nftMintAddress?: string | null;
    status: string;
}

export function ReceiptNFTDisplay({ invoiceId, nftMintAddress, status }: ReceiptNFTDisplayProps) {
    const [nftData, setNftData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Only fetch if paid and has mint address
        if (status === "paid" && nftMintAddress) {
            setLoading(true);
            fetch(`/api/nft-metadata/invoice-${invoiceId}`)
                .then((res) => res.json())
                .then((data) => {
                    setNftData(data);
                })
                .catch((err) => console.error("Failed to fetch NFT metadata", err))
                .finally(() => setLoading(false));
        }
    }, [invoiceId, nftMintAddress, status]);

    if (status !== "paid") return null;

    if (loading) {
        return (
            <div className="glass-card p-6 flex flex-col items-center justify-center animate-pulse">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                <p className="text-gray-400 text-sm">Loading Receipt...</p>
            </div>
        );
    }

    // If paid but no NFT minted yet (maybe processing or failed)
    if (!nftMintAddress) {
        return (
            <div className="glass-card p-6 border-l-4 border-yellow-500">
                <h3 className="text-lg font-semibold text-white mb-1">Payment Received</h3>
                <p className="text-gray-400 text-sm">
                    Receipt NFT is being minted or queued. Check back shortly.
                </p>
            </div>
        )
    }

    return (
        <div className="glass-card p-0 overflow-hidden group hover:border-purple-500/50 transition-colors">
            <div className="bg-gradient-to-r from-purple-900/40 to-black p-6 border-b border-white/10">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        Proof of Payment
                    </h3>
                    <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded border border-purple-500/30">
                        Compressed NFT
                    </span>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Image / Metadata */}
                <div className="col-span-1">
                    <div className="aspect-square bg-black/40 rounded-lg border border-white/10 flex items-center justify-center overflow-hidden">
                        {nftData?.image ? (
                            <img src={nftData.image} alt="Receipt NFT" className="w-full h-full object-cover" />
                        ) : (
                            <div className="text-center p-4">
                                <FileText className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                                <span className="text-gray-500 text-xs">No Image Preview</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Details */}
                <div className="col-span-2 space-y-4">
                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">NFT Name</label>
                        <div className="text-white font-medium">{nftData?.name || `Receipt #${invoiceId.slice(0, 8)}`}</div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Mint Address</label>
                        <div className="flex items-center gap-2 text-purple-300 break-all font-mono text-sm">
                            {nftMintAddress}
                            <NftExplorerLink type="token" value={nftMintAddress} className="opacity-50 hover:opacity-100" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
                        <p className="text-gray-400 text-sm line-clamp-2">
                            {nftData?.description || "Invoix Payment Receipt"}
                        </p>
                    </div>

                    <div className="pt-2">
                        <NftExplorerLink
                            type="token"
                            value={nftMintAddress}
                            className="inline-flex items-center gap-2 text-sm text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                        >
                            View on Solana Explorer <ExternalLink className="w-4 h-4" />
                        </NftExplorerLink>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Helper icon fallback
function FileText(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    )
}
