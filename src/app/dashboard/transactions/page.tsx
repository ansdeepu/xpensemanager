
"use client";

import { useState, useEffect, useMemo } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export default function TransactionsPage() {
  const [user, userLoading] = useAuthState(auth);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>));
        setRawAccounts(userAccounts);
        if (dataLoading) setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
      calculatedAccountBalances[acc.id] = 0; // Start at 0, not actualBalance
    });

    let calculatedCashBalance = 0;
    let calculatedDigitalBalance = 0;

    transactions.forEach(t => {
      if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
        calculatedAccountBalances[t.accountId] += t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
          calculatedAccountBalances[t.accountId] -= t.amount;
        } else if (t.paymentMethod === 'cash') {
          calculatedCashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          calculatedDigitalBalance -= t.amount;
        }
      } else if (t.type === 'transfer') {
        // From account
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
          calculatedAccountBalances[t.fromAccountId] -= t.amount;
        } else if (t.fromAccountId === 'cash-wallet') {
          calculatedCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          calculatedDigitalBalance -= t.amount;
        }
        // To account
        if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
          calculatedAccountBalances[t.toAccountId] += t.amount;
        } else if (t.toAccountId === 'cash-wallet') {
          calculatedCashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          calculatedDigitalBalance += t.amount;
        }
      }
    });

    return { 
      accountBalances: calculatedAccountBalances, 
      cashWalletBalance: calculatedCashBalance,
      digitalWalletBalance: calculatedDigitalBalance 
    };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0,
    }));
  }, [rawAccounts, accountBalances]);


  const primaryAccount = accounts.find(a => a.isPrimary);

  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const allBalance = (primaryAccount?.balance || 0) + cashWalletBalance + digitalWalletBalance;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={primaryAccount?.id || "all-accounts"} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-5 h-auto flex-wrap">
          {primaryAccount && (
            <TabsTrigger value={primaryAccount.id} className="flex flex-col h-auto py-2">
              <span>Primary ({primaryAccount.name})</span>
              <span className="font-bold text-primary">{formatCurrency(allBalance)}</span>
            </TabsTrigger>
          )}
          {accounts.filter(account => !account.isPrimary).map(account => (
            <TabsTrigger key={account.id} value={account.id} className="flex flex-col h-auto py-2">
              <span>{account.name}</span>
              <span className="font-bold text-primary">{formatCurrency(account.balance)}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {primaryAccount && (
            <TabsContent value={primaryAccount.id} className="mt-6">
                <TransactionTable accountId={primaryAccount.id} />
            </TabsContent>
        )}
         {accounts.filter(account => !account.isPrimary).map(account => (
            <TabsContent key={account.id} value={account.id} className="mt-6">
                <TransactionTable accountId={account.id} />
            </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
