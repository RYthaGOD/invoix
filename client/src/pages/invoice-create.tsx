/**
 * Invoice Creation Page
 * Allows users to create new invoices
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Trash2 } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { InvoiceForm, InvoiceFormData } from "@/components/invoice-form";
import { useCreateInvoiceWithArcium } from "@/hooks/use-arcium";
import { VersionedTransaction, Connection, clusterApiUrl, Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TREASURY_WALLET_ADDRESS, INVOICE_SERVICE_FEE_SOL } from "@shared/config";
import { Buffer } from "buffer";

// Polyfill for Buffer
if (typeof window !== "undefined") {
  window.Buffer = window.Buffer || Buffer;
}

export default function InvoiceCreate() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { walletAddress, isAuthenticated, login, authMode } = useAuth();
  const wallet = useWallet();
  const { connected } = wallet;
  const { createOnChainInvoice, status: arciumStatus, isProcessing: isArciumProcessing } = useCreateInvoiceWithArcium();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mintingStatus, setMintingStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateData, setTemplateData] = useState<Partial<InvoiceFormData>>({});

  // Fetch templates and price on load
  useEffect(() => {
    async function fetchTemplates() {
      // Allow fetching if walletAddress is present (Passkey or Connected Wallet)
      if (!walletAddress) return;
      try {
        const res = await fetch(`/api/templates?wallet=${walletAddress}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.templates)) {
            setTemplates(data.templates);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch templates", err);
      }
    }
    fetchTemplates();

    // Fetch SOL Price
    fetch("/api/pricing/sol")
      .then(res => res.json())
      .then(data => {
        if (data.price) setSolPrice(data.price);
      })
      .catch(err => console.error("Price fetch failed", err));
  }, [walletAddress]); // Changed from wallet.publicKey to walletAddress

  // Handle template selection
  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const tmpl = templates.find((t: any) => t.id === selectedTemplateId);
      if (tmpl) {
        // Map template fields to form fields
        try {
          const items = typeof tmpl.defaultLineItems === 'string'
            ? JSON.parse(tmpl.defaultLineItems)
            : tmpl.defaultLineItems;

          setTemplateData({
            paymentTerms: tmpl.defaultPaymentTerms || "Net 30",
            notes: tmpl.defaultNotes || "",
            lineItems: Array.isArray(items) ? items : [{ description: "", quantity: "1", unitPrice: "0" }]
          });

          toast({
            title: "Template Applied",
            description: `Loaded defaults from "${tmpl.name}"`,
          });
        } catch (e) {
          console.error("Error parsing template items", e);
        }
      }
    }
  }, [selectedTemplateId, templates, toast]);

  const onSubmit = async (data: InvoiceFormData) => {
    // 1. Connection Check
    // If Passkey, we rely on isAuthenticated. If CheckWallet/Traditional, we need connected.
    if (authMode !== 'passkey' && (!connected || !wallet?.publicKey)) {
      toast({
        variant: "destructive",
        title: "Wallet not connected",
        description: "Please connect your wallet to create an invoice.",
      });
      return;
    }

    // 2. Auth Session Check (Prevent "Pay but Fail" scenario)
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please sign the login message to verify your identity before creation.",
        variant: "default",
      });

      try {
        await login(); // Attempt auto-login
      } catch (e) {
        return; // User rejected login
      }
    }

    if (!walletAddress) {
      toast({
        variant: "destructive",
        title: "Session Error",
        description: "Could not determine your wallet address. Please refresh.",
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMintingStatus("");

    try {
      // 1. Create Invoice via API
      // Reconstruct payload as per API expectation
      const subtotal = data.lineItems.reduce((acc, item) => acc + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0);
      const fee = subtotal * (parseFloat(data.taxRate || "0") / 100);
      const discount = parseFloat(data.discountAmount || "0");
      const total = subtotal + fee - discount;

      // Resolve Token Mint (Default to USDC if not found)
      const currencyMints: Record<string, string> = {
        "SOL": "So11111111111111111111111111111111111111112",
        "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "PYUSD": "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
        "EURC": "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
      };

      const tokenMintAddress = currencyMints[data.currency || "USDC"] || currencyMints["USDC"];

      const finalPayload = {
        ...data,
        invoicerWalletAddress: walletAddress, // Use authenticated address (Passkey or Wallet)
        tokenMintAddress: tokenMintAddress,
        totalAmount: total.toFixed(2),
        paidAmount: "0",
        status: "draft",
        lineItems: data.lineItems.map(item => ({
          ...item,
          amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toString()
        }))
      };

      // Add Arcium allowed parties (Invoicer + Invoicee)
      if (data.encryptWithArcium) {
        (finalPayload as any).allowedParties = [
          walletAddress,
          data.invoiceeWalletAddress
        ];
      }

      // --- WALLET MISMATCH CHECK ---
      // Only applicable for Traditional wallets
      if (authMode !== 'passkey' && wallet.publicKey && walletAddress !== wallet.publicKey.toBase58()) {
        toast({
          title: "Wallet Mismatch",
          description: `You're connected with ${wallet.publicKey.toBase58().slice(0, 8)}... but authenticated as ${walletAddress.slice(0, 8)}... Please disconnect and reconnect with the correct wallet.`,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // --- x402 SPAM CONTROL ---
      // Pay 0.0001 SOL Service Fee
      if (authMode === 'passkey') {
        // Passkey users are sponsored (Gasless)
        // FIX: Append UUID to ensure uniqueness in database (x402PaymentSignature must be unique)
        const uniqueParams = crypto.randomUUID();
        console.log("Skipping service fee for Passkey user (Sponsored)");
        (finalPayload as any).x402PaymentSignature = `sponsored_lazorkit_passkey_${uniqueParams}`;
      } else {
        setMintingStatus("Paying Service Fee (0.0001 SOL)... 🛡️");

        if (!wallet.publicKey || !wallet.signTransaction) {
          throw new Error("Wallet does not support signing!");
        }

        const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("devnet"));

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: new PublicKey(TREASURY_WALLET_ADDRESS),
            lamports: parseFloat(INVOICE_SERVICE_FEE_SOL) * LAMPORTS_PER_SOL,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        const signedTx = await wallet.signTransaction(transaction);
        // Note: Using sendRawTransaction directly to control confirmation
        const signature = await connection.sendRawTransaction(signedTx.serialize());

        setMintingStatus("Verifying Fee... ⏳");
        await connection.confirmTransaction(signature, "confirmed");

        // Add signature to payload
        (finalPayload as any).x402PaymentSignature = signature;
      }

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        let errMessage = "Failed to create invoice";
        try {
          const errData = await res.json();
          errMessage = errData.message || errMessage;
        } catch (parseError) {
          // If JSON parse fails, read text
          const text = await res.text();
          console.error("API returned non-JSON error:", text);
          // Only show a snippet in the UI to avoid flooding it with HTML
          errMessage = `Server returned an error (${res.status}): ${text.slice(0, 100)}...`;
        }
        throw new Error(errMessage);
      }

      const { invoice, message } = await res.json();
      const invoiceId = invoice.id;

      toast({
        title: "Invoice Created",
        description: message,
      });

      // Verify Arcium Encryption Status & Create On-Chain Account
      if (data.encryptWithArcium) {
        if (!invoice.isArciumEncrypted) {
          toast({
            variant: "destructive",
            title: "Privacy Warning",
            description: "Arcium TEE was unavailable. Invoice was created WITHOUT encryption.",
          });
        } else {
          // Trigger On-Chain Flow
          try {
            // Update text to reflect Arcium status
            setMintingStatus("Securing with Arcium TEE...");

            await createOnChainInvoice({
              invoiceId: invoice.id,
              amount: invoice.totalAmount, // Use server returned amount
              dueDate: invoice.dueDate,
              currency: invoice.currency,
              invoiceeWalletAddress: invoice.invoiceeWalletAddress
            });

            toast({
              title: "Arcium Secure",
              description: "Invoice encrypted and verified on-chain.",
            });
          } catch (arciumErr) {
            // Don't block navigation, but show warning
            console.error("Arcium chain error", arciumErr);
            toast({
              variant: "destructive",
              title: "On-Chain Setup Pending",
              description: "Invoice created but on-chain account failed. You can retry from details page."
            });
          }
        }
      }

      // 2. Handle Client-Side Minting (if selected)
      if (data.mintNFT) {
        try {
          // Check if wallet is available for traditional flow
          // For passkey, we don't need a connected wallet, so we skip this check
          if (authMode !== 'passkey' && !wallet.signTransaction) {
            throw new Error("Wallet signing required for NFT minting in this mode.");
          }

          setMintingStatus(authMode === 'passkey' ? "Minting NFT (Gasless)... ✨" : "Preparing Mint Transaction...");

          // A. Request Transaction (or trigger server-side mint for passkey)
          // For passkey, we send the authenticated address (walletAddress)
          const walletParam = authMode === 'passkey' ? walletAddress! : wallet.publicKey!.toBase58();

          const mintRes = await fetch(`/api/nft/mint-invoice/${invoiceId}?wallet=${walletParam}`, {
            method: "POST",
            credentials: "include",
          });

          if (!mintRes.ok) {
            const err = await mintRes.json();
            throw new Error("Mint prep failed: " + (err.message || "Unknown error"));
          }

          const mintData = await mintRes.json();

          // NEW LOGIC: Check if server handled it (Passkey / Server-Side Mint)
          if (mintData.mintedOnServer) {
            console.debug(`✅ Minted NFT (Server-Side): ${mintData.signature}`);
            setMintingStatus("Success! ✨");

            toast({
              title: "NFT Minted",
              description: "Gasless NFT minting completed successfully!",
            });
          } else {
            // TRADITIONAL FLOW: Client signs the transaction
            const { transaction: base64Tx } = mintData;

            setMintingStatus("Please Sign (User Pays Fee) ✍️");

            // B. Deserialize
            const txBuffer = Buffer.from(base64Tx, "base64");
            const transaction = VersionedTransaction.deserialize(txBuffer);

            // C. Sign
            // @ts-expect-error - Checked above
            const signedTx = await wallet.signTransaction(transaction);

            // D. Send
            setMintingStatus("Sending Transaction... 🚀");
            const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || clusterApiUrl("devnet"));

            const signature = await connection.sendRawTransaction(signedTx.serialize());

            setMintingStatus("Confirming... ⏳");
            const confirmation = await connection.confirmTransaction(signature, "confirmed");

            if (confirmation.value.err) {
              throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }

            console.debug(`✅ Minted NFT: ${signature}`);
            setMintingStatus("Success! ✨");

            // E. Confirm with Server
            await fetch(`/api/nft/confirm-mint/${invoiceId}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ signature }),
            });
          }

        } catch (mintErr: any) {
          console.error("Minting failed:", mintErr);
          toast({
            variant: "destructive",
            title: "Minting Failed",
            description: "Invoice created, but NFT minting failed. You can retry later.",
          });
        }
      }

      // 3. Navigate to Invoice Detail
      navigate(`/invoices/${invoiceId}`);

    } catch (err: any) {
      console.error("Submission error:", err);
      let errorMessage = err.message || "An unexpected error occurred.";

      // Improve error message for common Devnet issues
      if (errorMessage.includes("Attempt to debit an account but found no record of a prior credit") ||
        errorMessage.includes("0x1")) {
        errorMessage = "Insufficient Devnet SOL. Please claim free SOL from the top banner to pay the transaction fee.";
      }

      setError(errorMessage);
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
      setMintingStatus("");
    }
  };

  return (
    <div className="min-h-screen pb-20 pt-8 px-4 md:px-8 space-y-8 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Create New Invoice
            </h1>
            <p className="text-gray-400 mt-1">
              Issue a new invoice on the Solana blockchain
              {solPrice && (
                <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  1 SOL ≈ ${solPrice.toFixed(2)}
                </span>
              )}
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex justify-between items-start gap-4 animate-in fade-in slide-in-from-top-2">
            <div>{error}</div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4 text-current" />
            </button>
          </div>
        )}

        {/* Reusable Form Component */}
        <InvoiceForm
          onSubmit={onSubmit}
          isSubmitting={isSubmitting || isArciumProcessing}
          mintingStatus={isArciumProcessing ? arciumStatus : mintingStatus}
          connected={authMode === 'passkey' ? isAuthenticated : connected} // Passkey auth replaces connected
          templates={templates}
          onTemplateSelect={setSelectedTemplateId}
          defaultValues={templateData}
          solPrice={solPrice}
        />

      </div>
    </div>
  );
}
