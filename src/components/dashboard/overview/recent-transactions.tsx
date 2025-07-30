
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import type { Transaction, Account } from "@/lib/data";

export function RecentTransactions() {
  const [user] = useAuthState(auth);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      });

      const transactionsQuery = query(
        collection(db, "transactions"), 
        where("userId", "==", user.uid),
        orderBy("date", "desc"),
        limit(5)
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setRecentTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    }
  }, [user, db]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const getAccountName = (transaction: Transaction) => {
    if (transaction.type === 'transfer') {
        return `Transfer`;
    }
    if (transaction.paymentMethod === 'wallet') {
        return "Wallet";
    }
    if (!transaction.accountId) return "N/A";
    return accounts.find((a) => a.id === transaction.accountId)?.name || "N/A";
  };
  
  const getTransactionIcon = (type: string) => {
    const iconClass = "h-5 w-5";
    if (type === 'income') {
      return <TrendingUp className={cn(iconClass, "text-green-500")} />;
    }
    return <TrendingDown className={cn(iconClass, "text-red-500")} />;
  }

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          A quick look at your latest financial activities.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentTransactions.map((transaction) => (
            <div key={transaction.id} className="flex items-center gap-4">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-muted">
                    {getTransactionIcon(transaction.type)}
                </AvatarFallback>
              </Avatar>
              <div className="grid gap-1 flex-1">
                <p className="text-sm font-medium leading-none">
                  {transaction.description}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getAccountName(transaction)}
                </p>
              </div>
              <div className={`font-medium ${transaction.type === 'income' ? 'text-green-600' : ''}`}>
                {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
