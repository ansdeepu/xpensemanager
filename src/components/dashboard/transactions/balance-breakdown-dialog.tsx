
"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Landmark, Wallet, Coins, CreditCard } from "lucide-react";
import type { Account } from "@/lib/data";

const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(val);
};

export function BalanceBreakdownDialog({
  isOpen,
  onOpenChange,
  breakdown,
  primaryAccount,
  primaryCreditCard,
  onAccountClick
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: any;
  primaryAccount: Account | undefined;
  primaryCreditCard: Account | undefined;
  onAccountClick: (account: any, name?: string) => void;
}) {
  if (!breakdown) return null;

  const handleSubClick = (id: string, name: string) => {
      onAccountClick(id, name);
      onOpenChange(false);
  }

  const sbiCardDue = primaryCreditCard ? (breakdown.cards[primaryCreditCard.id] || 0) : 0;
  const sbiCardAvailable = primaryCreditCard ? (primaryCreditCard.limit || 0) - sbiCardDue : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historical Balance Breakdown</DialogTitle>
          <DialogDescription>
            Detailed distribution of your Primary Ecosystem balance at this point in time.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {/* Primary Bank */}
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSubClick(primaryAccount!.id, primaryAccount!.name)}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank Balance</CardTitle>
                    <Landmark className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold font-mono">{formatCurrency(breakdown.bank)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">{primaryAccount?.name}</p>
                </CardContent>
            </Card>

            {/* Digital Wallet */}
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSubClick('digital-wallet', 'Digital Wallet')}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Digital Wallet</CardTitle>
                    <Wallet className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold font-mono">{formatCurrency(breakdown.digital)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">E-payments</p>
                </CardContent>
            </Card>

            {/* Cash Wallet */}
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSubClick('cash-wallet', 'Cash Wallet')}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cash Wallet</CardTitle>
                    <Coins className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg font-bold font-mono">{formatCurrency(breakdown.cash)}</div>
                    <p className="text-[10px] text-muted-foreground mt-1">Cash in hand</p>
                </CardContent>
            </Card>

            {/* SBI Credit Card */}
            {primaryCreditCard && (
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleSubClick(primaryCreditCard.id, primaryCreditCard.name)}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">SBI Credit Card</CardTitle>
                        <CreditCard className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold font-mono text-red-600">{formatCurrency(sbiCardAvailable)}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Available of {formatCurrency(primaryCreditCard.limit || 0)}</p>
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="border-t pt-4">
            <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
                <span className="font-bold text-base">Ecosystem Total</span>
                <span className="font-bold text-xl text-primary">{formatCurrency(breakdown.total)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2 italic">
                * Ecosystem Total = Bank Balance + Digital Wallet + Cash Wallet
            </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
