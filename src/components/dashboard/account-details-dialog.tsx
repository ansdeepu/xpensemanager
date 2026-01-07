
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
import { format, isAfter, parseISO } from "date-fns";
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
interface WalletAccountForDetails extends AccountForDetailsBase {}

type AccountForDetails = RegularAccountForDetails | WalletAccountForDetails;


export function AccountDetailsDialog({ account, transactions, isOpen, onOpenChange }: { account: AccountForDetails | null, transactions: Transaction[], isOpen: boolean, onOpenChange: (open: boolean) => void }) {

    const calculationResults = useMemo(() => {
        if (!account) return { breakdown: [], finalBalance: 0 };
        
        const isWallet = account.id === 'cash-wallet' || account.id === 'digital-wallet';

        let reconDate: Date;
        let runningBalance: number;

        if (isWallet) {
            const walletType = account.id === 'cash-wallet' ? 'cash' : 'digital';
            const walletPrefs = (account as any).walletPreferences?.[walletType];
            reconDate = walletPrefs?.date ? parseISO(walletPrefs.date) : new Date(0);
            runningBalance = walletPrefs?.balance ?? 0;
        } else {
            const regularAccount = account as RegularAccountForDetails;
            reconDate = regularAccount.actualBalanceDate ? parseISO(regularAccount.actualBalanceDate) : new Date(0);
            runningBalance = regularAccount.actualBalance ?? 0;
        }
        
        const relevantTransactions = transactions
            .filter(t => {
                const transactionDate = parseISO(t.date);
                if (isAfter(reconDate, transactionDate)) return false;

                if (account.id === 'cash-wallet') {
                    return t.paymentMethod === 'cash' || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet';
                }
                 if (account.id === 'digital-wallet') {
                    return t.paymentMethod === 'digital' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet';
                }
                // For regular accounts, include their income/expenses and transfers
                return (t.accountId === account.id && (t.type === 'income' || (t.type === 'expense' && t.paymentMethod === 'online'))) ||
                       t.fromAccountId === account.id ||
                       t.toAccountId === account.id;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const breakdown = relevantTransactions.map(t => {
            let credit = 0;
            let debit = 0;

            if (account.id === 'cash-wallet') {
                if(t.type === 'transfer' && t.toAccountId === 'cash-wallet') credit = t.amount;
                if(t.type === 'transfer' && t.fromAccountId === 'cash-wallet') debit = t.amount;
                if(t.type === 'expense' && t.paymentMethod === 'cash') debit = t.amount;
            } else if (account.id === 'digital-wallet') {
                if(t.type === 'transfer' && t.toAccountId === 'digital-wallet') credit = t.amount;
                if(t.type === 'transfer' && t.fromAccountId === 'digital-wallet') debit = t.amount;
                if(t.type === 'expense' && t.paymentMethod === 'digital') debit = t.amount;
            } else { // Regular bank account logic
                if (t.type === 'income' && t.accountId === account.id) {
                    credit = t.amount;
                } else if (t.type === 'expense' && t.accountId === account.id && t.paymentMethod === 'online') {
                    debit = t.amount;
                } else if (t.type === 'transfer') {
                    if (t.fromAccountId === account.id) {
                        debit = t.amount;
                    }
                    if (t.toAccountId === account.id) {
                        credit = t.amount;
                    }
                }
            }

            runningBalance += credit - debit;
            
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

    const isWallet = account.id === 'cash-wallet' || account.id === 'digital-wallet';
    
    let initialBalance: number;
    let reconDate: Date | null;

    if (isWallet) {
        const walletType = account.id === 'cash-wallet' ? 'cash' : 'digital';
        const walletPrefs = (account as any).walletPreferences?.[walletType];
        initialBalance = walletPrefs?.balance ?? 0;
        reconDate = walletPrefs?.date ? parseISO(walletPrefs.date) : new Date(0);
    } else {
        const regularAccount = account as RegularAccountForDetails;
        initialBalance = regularAccount.actualBalance ?? 0;
        reconDate = regularAccount.actualBalanceDate ? parseISO(regularAccount.actualBalanceDate) : null;
    }


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{account.name} - Balance Details</DialogTitle>
                    <DialogDescription>
                       A detailed breakdown of transactions affecting this account's balance. 
                       The current calculated balance is {formatCurrency(account.balance)}.
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-muted/50 font-semibold">
                                <TableCell>{reconDate ? format(reconDate, 'dd/MM/yyyy') : 'Start'}</TableCell>
                                <TableCell>Starting Balance</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-right font-mono">{formatCurrency(initialBalance)}</TableCell>
                            </TableRow>
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
                                        No transactions found since last reconciliation.
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
