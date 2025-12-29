
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthState } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Account } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const formatCurrency = (amount: number) => {
    // Return 0 if the amount is not a number or is 0, to avoid displaying "-₹0.00"
    if (amount === 0 || isNaN(amount)) {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
        }).format(0);
    }
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(amount);
};

export function MainStats() {
  const [user] = useAuthState(auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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

  const accountStats = useMemo(() => {
    const stats: Record<string, { income: number; expenses: number; transfersIn: number; transfersOut: number; balance: number; name: string }> = {};

    accounts.forEach(acc => {
        stats[acc.id] = { income: 0, expenses: 0, transfersIn: 0, transfersOut: 0, balance: 0, name: acc.name };
    });

    stats['cash-wallet'] = {
        income: 0,
        expenses: 0,
        transfersIn: 0,
        transfersOut: 0,
        balance: 0,
        name: "Cash Wallet"
    };
    stats['digital-wallet'] = {
        income: 0,
        expenses: 0,
        transfersIn: 0,
        transfersOut: 0,
        balance: 0,
        name: "Digital Wallet"
    };

    transactions.forEach(t => {
        if (t.type === 'income' && t.accountId && stats[t.accountId]) {
            stats[t.accountId].income += t.amount;
        } else if (t.type === 'expense') {
             if (t.paymentMethod === 'cash') {
                stats['cash-wallet'].expenses += t.amount;
             } else if (t.paymentMethod === 'digital') {
                stats['digital-wallet'].expenses += t.amount;
             } else if (t.accountId && stats[t.accountId]) {
                stats[t.accountId].expenses += t.amount;
             }
        } else if (t.type === 'transfer') {
            if(t.fromAccountId && stats[t.fromAccountId]) {
                stats[t.fromAccountId].transfersOut += t.amount;
            }
            if(t.toAccountId && stats[t.toAccountId]) {
                stats[t.toAccountId].transfersIn += t.amount;
            }
        }
    });

    Object.keys(stats).forEach(key => {
       stats[key].balance = stats[key].income - stats[key].expenses + stats[key].transfersIn - stats[key].transfersOut;
    });

    const orderedStats = [
        { id: 'cash-wallet', ...stats['cash-wallet'] },
        { id: 'digital-wallet', ...stats['digital-wallet'] }
    ];
    accounts.forEach(acc => {
        if (stats[acc.id]) {
            orderedStats.push({ id: acc.id, ...stats[acc.id] });
        }
    });
    
    return orderedStats;

  }, [accounts, transactions]);
  

  if (loading) {
    return (
        <Card>
             <CardHeader>
                <CardTitle>Financial Summary</CardTitle>
                <CardDescription>A summary of your income, expenses and current balance for each account.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                </div>
            </CardContent>
        </Card>
    )
  }

  return (
    <Card>
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
          <CardDescription>A summary of your income, expenses and current balance for each account.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Income</TableHead>
                        <TableHead className="text-right">Transfers</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Current Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accountStats.map(stat => {
                        const netTransfers = stat.transfersIn - stat.transfersOut;
                        return (
                        <TableRow key={stat.id}>
                            <TableCell className="font-medium">{stat.name}</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(stat.income)}</TableCell>
                            <TableCell className={cn("text-right", netTransfers >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(netTransfers)}</TableCell>
                            <TableCell className="text-right text-red-600">{formatCurrency(-stat.expenses)}</TableCell>
                            <TableCell className={cn("text-right font-medium", stat.balance >= 0 ? 'text-foreground' : 'text-red-600' )}>{formatCurrency(stat.balance)}</TableCell>
                        </TableRow>
                    )})}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}

    