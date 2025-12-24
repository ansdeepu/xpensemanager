
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account, Transaction, Category } from "@/lib/data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportView } from "@/components/dashboard/reports/report-view";


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export default function ReportsPage() {
  const [user, userLoading] = useAuthState(auth);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
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

      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
      calculatedAccountBalances[acc.id] = 0; 
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
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
          calculatedAccountBalances[t.fromAccountId] -= t.amount;
        } else if (t.fromAccountId === 'cash-wallet') {
          calculatedCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          calculatedDigitalBalance -= t.amount;
        }
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

  const getTransactionsForAccount = (accountId: string | 'all') => {
    if (accountId === 'all') {
      return transactions;
    }
    
    // For any specific account tab, filter transactions relevant to it.
    return transactions.filter(t => {
      // Regular income/expense tied to the account
      if ((t.type === 'income' || (t.type === 'expense' && t.paymentMethod === 'online')) && t.accountId === accountId) {
        return true;
      }
      // Expenses from wallets are not tied to a bank account ID, so they won't be included here, which is correct.
      
      // Transfers involving the account
      if (t.type === 'transfer') {
        // A transfer where this account is the source
        if (t.fromAccountId === accountId) {
            // To represent this as an "expense" for the report, we can return it as is.
            return true;
        }
        // A transfer where this account is the destination
        if (t.toAccountId === accountId) {
            // To represent this as an "income" for the report, we can create a modified transaction.
            // However, it's simpler to handle this logic inside the ReportView itself based on context.
            // For now, just include the original transaction. The view will interpret it.
            return true;
        }
      }
      return false;
    });
  }

  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </CardHeader>
          <CardTitle>
            <Skeleton className="h-10 w-full mb-6" />
            <Skeleton className="h-96 w-full" />
          </CardTitle>
        </Card>
      </div>
    );
  }
  
  const allBalance = (primaryAccount?.balance || 0) + cashWalletBalance + digitalWalletBalance;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-6 h-auto flex-wrap">
          <TabsTrigger value="all" className="flex flex-col h-auto p-2">
            <span>Overall Summary</span>
            <span className="font-bold text-primary">All Accounts</span>
          </TabsTrigger>
          {primaryAccount && (
            <TabsTrigger value={primaryAccount.id} className="flex flex-col h-auto p-2 items-start text-left">
              <span className="font-semibold text-sm">Primary ({primaryAccount.name})</span>
              <div className="w-full text-xs text-muted-foreground mt-1">
                  <div className="flex justify-between items-center">
                    <span>Bank: {formatCurrency(primaryAccount.balance)}</span>
                    <span>Cash: {formatCurrency(cashWalletBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span>Digital: {formatCurrency(digitalWalletBalance)}</span>
                    <span className="font-bold text-primary">{formatCurrency(allBalance)}</span>
                  </div>
              </div>
            </TabsTrigger>
          )}
          {accounts.filter(account => !account.isPrimary).map(account => (
            <TabsTrigger key={account.id} value={account.id} className="flex flex-col h-auto p-2">
              <span>{account.name}</span>
              <span className="font-bold text-primary">{formatCurrency(account.balance)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ReportView transactions={transactions} categories={categories} />
        </TabsContent>
        {accounts.map(account => (
          <TabsContent key={account.id} value={account.id} className="mt-6">
            <ReportView 
                transactions={transactions.filter(t => 
                    t.accountId === account.id || 
                    t.fromAccountId === account.id || 
                    t.toAccountId === account.id
                )} 
                categories={categories} 
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

    