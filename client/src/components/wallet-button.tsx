import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  const { publicKey, connected } = useWallet();

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
    
    return (
      <WalletMultiButton
        className="!bg-background !border !border-border !text-foreground !rounded-md !h-9 !px-4 !font-mono !text-sm hover-elevate active-elevate-2"
        data-testid="button-wallet-disconnect"
      >
        {shortAddress}
      </WalletMultiButton>
    );
  }

  return (
    <WalletMultiButton
      className="!bg-primary !text-primary-foreground !border-0 !rounded-md !h-9 !px-4 !font-normal hover-elevate active-elevate-2"
      data-testid="button-wallet-connect"
    >
      <Wallet className="mr-2 h-4 w-4" />
      Connect Wallet
    </WalletMultiButton>
  );
}
