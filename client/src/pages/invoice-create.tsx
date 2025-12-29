import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@solana/wallet-adapter-react";
import { InvoiceForm, InvoiceFormData } from "@/components/invoice-form";
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
  const { walletAddress, isAuthenticated, login } = useAuth();
  const wallet = useWallet();
  const { connected } = wallet;

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
      if (!wallet?.publicKey) return;
      try {
        const res = await fetch(`/api/templates?wallet=${wallet.publicKey.toBase58()}`);
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
  }, [wallet?.publicKey]);

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
    if (!connected || !wallet?.publicKey) {
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
        // We can't easily wait for state update here since it's async hook state.
        // But login() promise resolves when flow complete.
        // We re-check authenticated state, but since we are in a closure, 'isAuthenticated' is stale.
        // However, if login() throws, we fall to catch. 
        // If it succeeds, we *assume* we are good (cookie set).
      } catch (e) {
        return; // User rejected login
      }
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
      // Note: In a real app, importing from @shared/stablecoin-config would be ideal, 
      // but simplistic mapping is fine given we only support a few.
      // Better: let the server handle it? No, Zod requires it.
      const currencyMints: Record<string, string> = {
        "SOL": "So11111111111111111111111111111111111111112", // Native SOL wrapped mint
        "USDC": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // Mainnet USDC
        "USDT": "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
        "PYUSD": "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", // PayPal USD (Mainnet - fixed)
        "EURC": "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", // Euro Coin (fixed)
      };
      // Devnet overrides if needed, or just send a valid string if server re-checks.
      // Since server overrides it anyway, we just need to pass Zod validation with a valid-looking string.
      // But let's try to be accurate.

      const tokenMintAddress = currencyMints[data.currency || "USDC"] || currencyMints["USDC"];

      const finalPayload = {
        ...data,
        invoicerWalletAddress: wallet.publicKey.toBase58(),
        tokenMintAddress: tokenMintAddress,
        totalAmount: total.toFixed(2),
        paidAmount: "0",
        status: "draft",
        // Flatten line items logic
        lineItems: data.lineItems.map(item => ({
          ...item,
          amount: (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toString()
        }))
      };

      // Add Arcium allowed parties (Invoicer + Invoicee)
      if (data.encryptWithArcium) {
        (finalPayload as any).allowedParties = [
          wallet.publicKey.toBase58(),
          data.invoiceeWalletAddress
        ];
      }

      // --- WALLET MISMATCH CHECK ---
      // Ensure connected wallet matches authenticated wallet
      if (walletAddress && wallet.publicKey.toBase58() !== walletAddress) {
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
      setMintingStatus("Paying Service Fee (0.0001 SOL)... 🛡️");

      if (!wallet.signTransaction) {
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
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      setMintingStatus("Verifying Fee... ⏳");
      await connection.confirmTransaction(signature, "confirmed");

      // Add signature to payload
      (finalPayload as any).x402PaymentSignature = signature;
      // -------------------------

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalPayload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to create invoice");
      }

      const { invoice, message } = await res.json();
      const invoiceId = invoice.id;

      toast({
        title: "Invoice Created",
        description: message,
      });

      // Verify Arcium Encryption Status
      if (data.encryptWithArcium && !invoice.isArciumEncrypted) {
        toast({
          variant: "destructive",
          title: "Privacy Warning",
          description: "Arcium TEE was unavailable. Invoice was created WITHOUT encryption.",
        });
      }

      // 2. Handle Client-Side Minting (if selected)
      if (data.mintNFT && wallet.signTransaction) {
        try {
          setMintingStatus("Preparing Mint Transaction...");

          // A. Request Transaction
          const mintRes = await fetch(`/api/nft/mint-invoice/${invoiceId}?wallet=${wallet.publicKey.toBase58()}`, {
            method: "POST",
          });

          if (!mintRes.ok) {
            const err = await mintRes.json();
            throw new Error("Mint prep failed: " + (err.message || "Unknown error"));
          }

          const { transaction: base64Tx } = await mintRes.json();

          setMintingStatus("Please Sign (User Pays Fee) ✍️");

          // B. Deserialize
          const txBuffer = Buffer.from(base64Tx, "base64");
          const transaction = VersionedTransaction.deserialize(txBuffer);

          // C. Sign
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
            body: JSON.stringify({ signature }),
          });

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

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Reusable Form Component */}
        <InvoiceForm
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          mintingStatus={mintingStatus}
          connected={connected}
          templates={templates}
          onTemplateSelect={setSelectedTemplateId}
          defaultValues={templateData}
        />

      </div>
    </div>
  );
}
