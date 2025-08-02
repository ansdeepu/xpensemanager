
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";

export function AccountBalances() {
  const [user] = useAuthState(auth);
  const [accounts, setAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<(Omit<Account, 'balance'> & { balance: number }) | { id: 'wallet', name: string, balance: number } | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = [];
        snapshot.forEach((doc) => {
          // Destructure to remove balance if it exists in Firestore data
          const { balance, ...data } = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setAccounts(userAccounts);
        setLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!user) {
        setLoading(false);
    }
  }, [user, db]);

  const { walletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    accounts.forEach(acc => {
        calculatedAccountBalances[acc.id] = 0; // Start with 0
    });

    let calculatedWalletBalance = 0;

    transactions.forEach(t => {
        // Wallet balance calculation
        if (t.type === 'transfer') {
            if (t.toAccountId === 'wallet') calculatedWalletBalance += t.amount;
            if (t.fromAccountId === 'wallet') calculatedWalletBalance -= t.amount;
        } else if (t.type === 'expense' && t.paymentMethod === 'wallet') {
            calculatedWalletBalance -= t.amount;
        }

        // Bank account balance calculation
        if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod !== 'wallet' && calculatedAccountBalances[t.accountId] !== undefined) {
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

    return { walletBalance: calculatedWalletBalance, accountBalances: calculatedAccountBalances };
  }, [accounts, transactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const handleAccountClick = (account: Omit<Account, 'balance'> | 'wallet') => {
    if (account === 'wallet') {
        setSelectedAccountForDetails({
            id: 'wallet',
            name: 'Digital Wallet',
            balance: walletBalance
        });
    } else {
        setSelectedAccountForDetails({
            ...account,
            balance: accountBalances[account.id] ?? 0
        });
    }
    setIsDetailsDialogOpen(true);
  };

  if (loading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                 <Card className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                       <CardTitle className="text-sm font-medium">Digital Wallet</CardTitle>
                       <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(walletBalance)}</div>
                    </CardContent>
                </Card>
                {accounts.map(account => (
                     <Card key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                         <CardHeader className="flex flex-row items-center justify-between pb-2">
                           <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                           <Landmark className="h-4 w-4 text-muted-foreground" />
                         </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(accountBalances[account.id] ?? 0)}</div>
                        </CardContent>
                    </Card>
                ))}
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
