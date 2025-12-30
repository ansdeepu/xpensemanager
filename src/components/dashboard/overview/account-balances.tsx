
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
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";
import { useAuthState } from "@/hooks/use-auth-state";


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
          const { balance, ...data } = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setRawAccounts(userAccounts);
        if(dataLoading) setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });
      
      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!user && dataLoading) {
        setDataLoading(false);
    }
  }, [user, db, dataLoading]);

  const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
        calculatedAccountBalances[acc.id] = 0; // Start with 0
    });

    let calculatedCashWalletBalance = 0;
    let calculatedDigitalWalletBalance = 0;

    transactions.forEach(t => {
      // Wallet balance calculation
      if (t.type === 'transfer') {
        if (t.toAccountId === 'cash-wallet') calculatedCashWalletBalance += t.amount;
        if (t.fromAccountId === 'cash-wallet') calculatedCashWalletBalance -= t.amount;
        if (t.toAccountId === 'digital-wallet') calculatedDigitalWalletBalance += t.amount;
        if (t.fromAccountId === 'digital-wallet') calculatedDigitalWalletBalance -= t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'cash') calculatedCashWalletBalance -= t.amount;
        if (t.paymentMethod === 'digital') calculatedDigitalWalletBalance -= t.amount;
      }

        // Bank account balance calculation
        if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] -= t.amount;
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
                calculatedAccountBalances[t.fromAccountId] -= t.amount;
            }
            if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
                calculatedAccountBalances[t.toAccountId] += t.amount;
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
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
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
              <CardContent className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-24 w-full" />
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
            <CardDescription>Click any account to see a detailed balance breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                 <Card className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('cash-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between p-3">
                    <CardTitle className="text-xs font-medium">Cash Wallet</CardTitle>
                    <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{formatCurrency(cashWalletBalance)}</div>
                    </CardContent>
                </Card>
                 <Card className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('digital-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between p-3">
                    <CardTitle className="text-xs font-medium">Digital Wallet</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{formatCurrency(digitalWalletBalance)}</div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    return (
                     <Card key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                        <CardHeader className="flex flex-row items-center justify-between p-3">
                        <CardTitle className="text-xs font-medium">{account.name}</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{formatCurrency(account.balance)}</div>
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
