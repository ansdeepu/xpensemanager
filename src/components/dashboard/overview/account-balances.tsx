
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<Account | { id: 'wallet', name: string, balance: number } | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
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

  const walletBalance = useMemo(() => {
    const income = transactions
        .filter(t => t.type === 'transfer' && t.toAccountId === 'wallet')
        .reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions
        .filter(t => t.type === 'expense' && t.paymentMethod === 'wallet')
        .reduce((sum, t) => sum + t.amount, 0);
        
    const transfersOut = transactions
        .filter(t => t.type === 'transfer' && t.fromAccountId === 'wallet')
        .reduce((sum, t) => sum + t.amount, 0);

    return income - expenses - transfersOut;
  }, [transactions]);

  const calculatedBalances = useMemo(() => {
    const balances: { [key: string]: number } = {};
    accounts.forEach(acc => {
        balances[acc.id] = 0;
    });

    transactions.forEach(t => {
        if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
            balances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && balances[t.accountId] !== undefined) {
            balances[t.accountId] -= t.amount;
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && balances[t.fromAccountId] !== undefined) {
                balances[t.fromAccountId] -= t.amount;
            }
            if (t.toAccountId && balances[t.toAccountId] !== undefined) {
                balances[t.toAccountId] += t.amount;
            }
        }
    });
    return balances;
  }, [accounts, transactions]);


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const handleAccountClick = (account: Account | 'wallet') => {
    if (account === 'wallet') {
        setSelectedAccountForDetails({
            id: 'wallet',
            name: 'Wallet',
            balance: walletBalance
        });
    } else {
         setSelectedAccountForDetails({
            ...account,
            balance: calculatedBalances[account.id] ?? 0
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
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
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
                 <div className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('wallet')}>
                    <Wallet className="h-8 w-8 text-muted-foreground" />
                    <div>
                        <div className="font-medium">Wallet</div>
                        <div className="text-2xl font-bold">{formatCurrency(walletBalance)}</div>
                    </div>
                </div>
                {accounts.map(account => (
                    <div key={account.id} className="flex items-center gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                        <Landmark className="h-8 w-8 text-muted-foreground" />
                        <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-2xl font-bold">{formatCurrency(calculatedBalances[account.id] ?? 0)}</div>
                        </div>
                    </div>
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
