import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from "@/hooks/use-auth";

export function WalletButton() {
  const { publicKey, connected } = useWallet();
  const { isAuthenticated, login, isLoading } = useAuth();

  // Case 1: Wallet Connected AND Authenticated (Normal State)
  if (connected && publicKey && isAuthenticated) {
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

  // Case 2: Wallet Connected but NOT Authenticated ("Double Wallet" Limbo)
  if (connected && publicKey && !isAuthenticated) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => login()}
        disabled={isLoading}
        className="animate-pulse bg-amber-500 hover:bg-amber-600 text-black border-amber-600 font-bold"
      >
        {isLoading ? "Signing..." : "Sign to Login"}
      </Button>
    );
  }

  // Case 3: Not Connected (Standard)
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
