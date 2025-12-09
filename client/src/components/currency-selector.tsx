/**
 * Currency Selector Component
 * Allows users to select from supported stablecoins
 */

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// Stablecoin options
const STABLECOINS = [
    {
        symbol: "USDC",
        name: "USD Coin",
        icon: "💵",
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    },
    {
        symbol: "USDT",
        name: "Tether USD",
        icon: "💲",
        mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    },
    {
        symbol: "PYUSD",
        name: "PayPal USD",
        icon: "🅿️",
        mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo",
    },
    {
        symbol: "EURC",
        name: "Euro Coin",
        icon: "💶",
        mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr",
    },
];

interface CurrencySelectorProps {
    value: string;
    onChange: (currency: string, mint: string) => void;
    disabled?: boolean;
}

export function CurrencySelector({ value, onChange, disabled }: CurrencySelectorProps) {
    const [open, setOpen] = useState(false);

    const selectedCurrency = STABLECOINS.find((c) => c.symbol === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled}
                >
                    {selectedCurrency ? (
                        <span className="flex items-center gap-2">
                            <span className="text-lg">{selectedCurrency.icon}</span>
                            <span className="font-medium">{selectedCurrency.symbol}</span>
                            <span className="text-muted-foreground text-sm">
                                {selectedCurrency.name}
                            </span>
                        </span>
                    ) : (
                        "Select currency..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0">
                <Command>
                    <CommandInput placeholder="Search currency..." />
                    <CommandEmpty>No currency found.</CommandEmpty>
                    <CommandGroup>
                        {STABLECOINS.map((currency) => (
                            <CommandItem
                                key={currency.symbol}
                                value={currency.symbol}
                                onSelect={() => {
                                    onChange(currency.symbol, currency.mint);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === currency.symbol ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <span className="text-lg mr-2">{currency.icon}</span>
                                <div className="flex flex-col">
                                    <span className="font-medium">{currency.symbol}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {currency.name}
                                    </span>
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// Export stablecoin list for use in other components
export { STABLECOINS };
