
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet, Coins } from "lucide-react";
import { useAuthState } from "@/hooks/use-auth-state";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";

type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Omit<Account, 'balance'> & { balance: number }) | { id: WalletType, name: string, balance: number };

export function AccountBalances() {
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setRawAccounts(userAccounts);
        setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!user && !userLoading) {
        setDataLoading(false);
    }
  }, [user, userLoading]);

  const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    const accountMap = new Map(rawAccounts.map(acc => [acc.id, acc]));

    rawAccounts.forEach(acc => {
        calculatedAccountBalances[acc.id] = 0;
    });

    let calculatedCashWalletBalance = 0;
    let calculatedDigitalWalletBalance = 0;

    const chronologicalTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    chronologicalTransactions.forEach(t => {
      // Income
      if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
          const account = accountMap.get(t.accountId);
          if (account?.type !== 'card') {
            calculatedAccountBalances[t.accountId] += t.amount;
          }
      } 
      // Expenses
      else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if (account?.type === 'card') {
              calculatedAccountBalances[t.accountId] += t.amount; // Debt increases
            } else {
              calculatedAccountBalances[t.accountId] -= t.amount; // Balance decreases
            }
        } else if (t.paymentMethod === 'cash') {
          calculatedCashWalletBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          calculatedDigitalWalletBalance -= t.amount;
        }
      } 
      // Transfers
      else if (t.type === 'transfer') {
        // From
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
          const fromAccount = accountMap.get(t.fromAccountId);
          if (fromAccount?.type === 'card') {
            calculatedAccountBalances[t.fromAccountId] += t.amount; // Cash advance increases debt
          } else {
            calculatedAccountBalances[t.fromAccountId] -= t.amount;
          }
        } else if (t.fromAccountId === 'cash-wallet') {
          calculatedCashWalletBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          calculatedDigitalWalletBalance -= t.amount;
        }

        // To
        if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
           const toAccount = accountMap.get(t.toAccountId);
           if (toAccount?.type === 'card') {
             calculatedAccountBalances[t.toAccountId] -= t.amount; // Payment to card decreases debt
           } else {
             calculatedAccountBalances[t.toAccountId] += t.amount;
           }
        } else if (t.toAccountId === 'cash-wallet') {
          calculatedCashWalletBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          calculatedDigitalWalletBalance += t.amount;
        }
      }
    });

    return { cashWalletBalance: calculatedCashWalletBalance, digitalWalletBalance: calculatedDigitalWalletBalance, accountBalances: calculatedAccountBalances };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0,
    }));
  }, [rawAccounts, accountBalances]);

  const formatCurrency = (amount: number) => {
    let val = amount;
    if (Object.is(val, -0)) val = 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const handleAccountClick = (accountOrWallet: Omit<Account, 'balance'> | WalletType) => {
    if (accountOrWallet === 'cash-wallet') {
      setSelectedAccountForDetails({
        id: 'cash-wallet',
        name: 'Cash Wallet',
        balance: cashWalletBalance
      });
    } else if (accountOrWallet === 'digital-wallet') {
      setSelectedAccountForDetails({
        id: 'digital-wallet',
        name: 'Digital Wallet',
        balance: digitalWalletBalance
      });
    } else {
      setSelectedAccountForDetails({
        ...accountOrWallet,
        balance: accountBalances[accountOrWallet.id] ?? 0
      });
    }
    setIsDetailsDialogOpen(true);
  };

  if (userLoading || dataLoading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      )
  }

  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Click any account to see a detailed transaction breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAccountClick('cash-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Cash Wallet</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(cashWalletBalance)}</div>
                    </CardContent>
                </Card>
                 <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAccountClick('digital-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Digital Wallet</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(digitalWalletBalance)}</div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    const isCard = account.type === 'card';
                    const availableLimit = isCard ? ((account.limit || 0) - account.balance) : 0;
                    const displayBalance = isCard ? availableLimit : account.balance;
                    
                    return (
                     <Card key={account.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => handleAccountClick(account)}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(displayBalance)}</div>
                            {isCard && <p className="text-[10px] text-muted-foreground mt-1">Available of {formatCurrency(account.limit || 0)}</p>}
                        </CardContent>
                    </Card>
                )})}
            </div>
        </CardContent>
    </Card>

    <AccountDetailsDialog
        account={selectedAccountForDetails}
        transactions={transactions}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
    />
    </>
  );
}
