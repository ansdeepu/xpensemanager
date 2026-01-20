
"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { Account, Transaction } from "@/lib/data";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea } from "../ui/scroll-area";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type WalletType = 'cash-wallet' | 'digital-wallet';

interface AccountForDetailsBase {
    id: string;
    name: string;
    balance: number;
}

interface RegularAccountForDetails extends AccountForDetailsBase, Omit<Account, 'id' | 'name' | 'balance'> {}
interface WalletAccountForDetails extends AccountForDetailsBase {
    walletPreferences?: any;
}

type AccountForDetails = RegularAccountForDetails | WalletAccountForDetails;


export function AccountDetailsDialog({ account, transactions, isOpen, onOpenChange }: { account: AccountForDetails | null, transactions: Transaction[], isOpen: boolean, onOpenChange: (open: boolean) => void }) {

    const calculationResults = useMemo(() => {
        if (!account) return { breakdown: [], finalBalance: 0 };
        
        const chronologicalTransactions = [...transactions]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        
        const openingBalanceTx = chronologicalTransactions.find(t => t.category === 'Previous balance' && t.accountId === account.id);
        if (openingBalanceTx) {
            runningBalance = openingBalanceTx.amount;
        }

        const breakdown = chronologicalTransactions
            .filter(t => {
                if (openingBalanceTx && t.id === openingBalanceTx.id) return true; // Always include opening balance
                
                let belongsToAccount = false;
                if (account.id === 'cash-wallet') {
                    belongsToAccount = t.paymentMethod === 'cash' || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet';
                } else if (account.id === 'digital-wallet') {
                    belongsToAccount = t.paymentMethod === 'digital' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet';
                } else {
                    belongsToAccount = (t.accountId === account.id && (t.type === 'income' || (t.type === 'expense' && t.paymentMethod === 'online'))) ||
                       t.fromAccountId === account.id ||
                       t.toAccountId === account.id;
                }
                return belongsToAccount && t.category !== 'Previous balance';
            })
            .map(t => {
                let credit = 0;
                let debit = 0;
                let effect = 0;
                const isCard = 'type' in account && account.type === 'card';

                if (t.id === openingBalanceTx?.id) {
                    credit = t.amount;
                    effect = 0; // The effect is already in the initial runningBalance
                } else {
                    if (account.id === 'cash-wallet') {
                        if(t.type === 'transfer' && t.toAccountId === 'cash-wallet') { credit = t.amount; effect = t.amount; }
                        if(t.type === 'transfer' && t.fromAccountId === 'cash-wallet') { debit = t.amount; effect = -t.amount; }
                        if(t.type === 'expense' && t.paymentMethod === 'cash') { debit = t.amount; effect = -t.amount; }
                    } else if (account.id === 'digital-wallet') {
                        if(t.type === 'transfer' && t.toAccountId === 'digital-wallet') { credit = t.amount; effect = t.amount; }
                        if(t.type === 'transfer' && t.fromAccountId === 'digital-wallet') { debit = t.amount; effect = -t.amount; }
                        if(t.type === 'expense' && t.paymentMethod === 'digital') { debit = t.amount; effect = -t.amount; }
                    } else if (isCard) {
                        // Card logic: 'balance' is amount due
                        if (t.type === 'expense' && t.accountId === account.id && t.paymentMethod === 'online') {
                            debit = t.amount; effect = t.amount; // Expenses increase due
                        } else if (t.type === 'transfer') {
                            if (t.toAccountId === account.id) { // Payment to card
                                credit = t.amount; effect = -t.amount; // Decreases due
                            }
                            if (t.fromAccountId === account.id) { // Cash advance
                                debit = t.amount; effect = t.amount; // Increases due
                            }
                        }
                    } else { // Regular bank account logic
                        if (t.type === 'income' && t.accountId === account.id) {
                            credit = t.amount; effect = t.amount;
                        } else if (t.type === 'expense' && t.accountId === account.id && t.paymentMethod === 'online') {
                            debit = t.amount; effect = -t.amount;
                        } else if (t.type === 'transfer') {
                            if (t.fromAccountId === account.id) {
                                debit = t.amount; effect = -t.amount;
                            }
                            if (t.toAccountId === account.id) {
                                credit = t.amount; effect = t.amount;
                            }
                        }
                    }
                }
                
                // Add the effect of the current transaction to the running balance
                runningBalance += effect;

                return {
                    id: t.id,
                    date: t.date,
                    description: t.description,
                    credit,
                    debit,
                    balance: runningBalance,
                };
            });
        
        return { breakdown: breakdown.reverse(), finalBalance: runningBalance };

    }, [account, transactions]);


    if (!account) return null;

    const isCard = 'type' in account && account.type === 'card';
    const cardLimit = isCard && 'limit' in account ? (account as RegularAccountForDetails).limit : undefined;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{account.name} - Full Transaction History</DialogTitle>
                    <DialogDescription>
                       A detailed, all-time breakdown of transactions affecting this account's balance. 
                       The final calculated {isCard ? "due amount" : "balance"} is {formatCurrency(calculationResults.finalBalance)}.
                       {isCard && cardLimit != null && ` The credit limit is ${formatCurrency(cardLimit)}.`}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">{isCard ? "Payments" : "Credit"}</TableHead>
                                <TableHead className="text-right">{isCard ? "Charges" : "Debit"}</TableHead>
                                <TableHead className="text-right">{isCard ? "Due Amount" : "Balance"}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {calculationResults.breakdown.length > 0 ? (
                                calculationResults.breakdown.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="font-medium">{item.description}</TableCell>
                                        <TableCell className="text-right font-mono text-green-600">
                                            {item.credit > 0 ? formatCurrency(item.credit) : null}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-red-600">
                                            {item.debit > 0 ? formatCurrency(item.debit) : null}
                                        </TableCell>
                                         <TableCell className={cn("text-right font-mono", item.balance < 0 && "text-red-600")}>
                                            {formatCurrency(item.balance)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                        No transactions found for this account.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

    