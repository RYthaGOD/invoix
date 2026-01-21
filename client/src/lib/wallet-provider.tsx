import { FC, ReactNode, useMemo, useState, useEffect, createContext, useContext } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { createSolanaRpc, Rpc, type SolanaRpcApi } from '@solana/kit';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// --- Modern Context Definition ---
interface SolanaModernContextState {
  rpc: Rpc<SolanaRpcApi>; // Standard Solana RPC interface
}

const SolanaModernContext = createContext<SolanaModernContextState | null>(null);

export const useSolanaModern = () => {
  const context = useContext(SolanaModernContext);
  if (!context) {
    throw new Error("useSolanaModern must be used within a SolanaWalletProvider");
  }
  return context;
};

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({ children }) => {
  const [LazorkitProvider, setLazorkitProvider] = useState<any>(null);

  // Use custom RPC (Helius) for better performance, fallback to devnet
  const endpoint = useMemo(() => {
    // Priority: Environment variable (Helius) > default devnet
    if (import.meta.env.VITE_SOLANA_RPC_URL) {
      return import.meta.env.VITE_SOLANA_RPC_URL;
    }
    // Fallback based on network config
    const network = import.meta.env.VITE_SOLANA_NETWORK === 'mainnet-beta'
      ? 'mainnet-beta'
      : 'devnet';
    return clusterApiUrl(network as any);
  }, []);

  // Initialize Modern RPC Client (v2)
  const modernRpc = useMemo(() => {
    // Create the RPC client using the same endpoint
    return createSolanaRpc(endpoint) as Rpc<SolanaRpcApi>;
  }, [endpoint]);

  // Browser wallets auto-detected (Phantom, Solflare, etc.)
  const wallets = useMemo(() => [], []);

  // LazorKit configuration (only if enabled)
  const lazorkitConfig = useMemo(() => ({
    rpcUrl: import.meta.env.VITE_LAZORKIT_RPC_URL || 'https://api.devnet.solana.com',
    portalUrl: import.meta.env.VITE_LAZORKIT_PORTAL_URL || 'https://portal.lazor.sh',
    paymasterConfig: {
      paymasterUrl: import.meta.env.VITE_LAZORKIT_PAYMASTER_URL || 'https://kora.devnet.lazorkit.com'
    }
  }), []);

  // Dynamically load LazorKit (always enabled now)
  useEffect(() => {
    if (!LazorkitProvider) {
      import('@lazorkit/wallet')
        .then((module) => {
          setLazorkitProvider(() => module.LazorkitProvider);
        })
        .catch((e) => {
          console.warn('[Wallet Provider] LazorKit not available:', e);
        });
    }
  }, [LazorkitProvider]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaModernContext.Provider value={{ rpc: modernRpc }}>
            {LazorkitProvider ? (
              <LazorkitProvider {...lazorkitConfig}>
                {children}
              </LazorkitProvider>
            ) : (
              children
            )}
          </SolanaModernContext.Provider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
