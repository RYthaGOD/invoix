import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { setWalletInstance, signMessageWithWallet, createSignatureMessage } from '@/lib/wallet-signature';

/**
 * Hook that integrates Solana Wallet Adapter with our signature utilities
 */
export function useWalletSignature() {
  const wallet = useWallet();

  // Keep wallet instance updated
  useEffect(() => {
    setWalletInstance(wallet);
  }, [wallet, wallet.connected, wallet.publicKey]);

  return {
    wallet,
    signMessage: signMessageWithWallet,
    createMessage: createSignatureMessage,
    isConnected: wallet.connected && !!wallet.publicKey,
    publicKey: wallet.publicKey?.toBase58() || null,
  };
}
