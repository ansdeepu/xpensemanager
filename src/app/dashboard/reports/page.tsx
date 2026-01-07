
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import type { Account, Transaction, Category } from "@/lib/data";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportView } from "@/components/dashboard/reports/report-view";
import { useAuthState } from "@/hooks/use-auth-state";
import { isAfter, parseISO } from "date-fns";


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export default function ReportsPage() {
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
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

      const preferencesDocRef = doc(db, "user_preferences", user.uid);
      const unsubscribePreferences = onSnapshot(preferencesDocRef, (doc) => {
        if (doc.exists()) {
          setWalletPreferences(doc.data().wallets || {});
        }
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
        unsubscribePreferences();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
      calculatedAccountBalances[acc.id] = acc.actualBalance ?? 0;
    });

    let calculatedCashBalance = walletPreferences.cash?.balance ?? 0;
    let calculatedDigitalBalance = walletPreferences.digital?.balance ?? 0;

    const cashReconDate = walletPreferences.cash?.date ? parseISO(walletPreferences.cash.date) : new Date(0);
    const digitalReconDate = walletPreferences.digital?.date ? parseISO(walletPreferences.digital.date) : new Date(0);
    
    transactions.forEach(t => {
      const transactionDate = parseISO(t.date);

      if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
        const accountReconDate = rawAccounts.find(a => a.id === t.accountId)?.actualBalanceDate ? parseISO(rawAccounts.find(a => a.id === t.accountId)!.actualBalanceDate!) : new Date(0);
        if (isAfter(transactionDate, accountReconDate)) {
            calculatedAccountBalances[t.accountId] += t.amount;
        }
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            const accountReconDate = rawAccounts.find(a => a.id === t.accountId)?.actualBalanceDate ? parseISO(rawAccounts.find(a => a.id === t.accountId)!.actualBalanceDate!) : new Date(0);
            if (isAfter(transactionDate, accountReconDate)) {
              calculatedAccountBalances[t.accountId] -= t.amount;
            }
        } else if (t.paymentMethod === 'cash' && isAfter(transactionDate, cashReconDate)) {
          calculatedCashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital' && isAfter(transactionDate, digitalReconDate)) {
          calculatedDigitalBalance -= t.amount;
        }
      } else if (t.type === 'transfer') {
        // From Account
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
            const fromAccountReconDate = rawAccounts.find(a => a.id === t.fromAccountId)?.actualBalanceDate ? parseISO(rawAccounts.find(a => a.id === t.fromAccountId)!.actualBalanceDate!) : new Date(0);
            if (isAfter(transactionDate, fromAccountReconDate)) {
              calculatedAccountBalances[t.fromAccountId] -= t.amount;
            }
        } else if (t.fromAccountId === 'cash-wallet' && isAfter(transactionDate, cashReconDate)) {
          calculatedCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet' && isAfter(transactionDate, digitalReconDate)) {
          calculatedDigitalBalance -= t.amount;
        }
        // To Account
        if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
          const toAccountReconDate = rawAccounts.find(a => a.id === t.toAccountId)?.actualBalanceDate ? parseISO(rawAccounts.find(a => a.id === t.toAccountId)!.actualBalanceDate!) : new Date(0);
          if (isAfter(transactionDate, toAccountReconDate)) {
            calculatedAccountBalances[t.toAccountId] += t.amount;
          }
        } else if (t.toAccountId === 'cash-wallet' && isAfter(transactionDate, cashReconDate)) {
          calculatedCashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet' && isAfter(transactionDate, digitalReconDate)) {
          calculatedDigitalBalance += t.amount;
        }
      }
    });

    return { 
      accountBalances: calculatedAccountBalances, 
      cashWalletBalance: calculatedCashBalance,
      digitalWalletBalance: calculatedDigitalBalance 
    };
  }, [rawAccounts, transactions, walletPreferences]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? (acc.actualBalance ?? 0),
    }));
  }, [rawAccounts, accountBalances]);

  const primaryAccount = accounts.find(a => a.isPrimary);

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
  
  const allBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0) + cashWalletBalance + digitalWalletBalance;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={primaryAccount?.id || 'all'} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-6 h-auto flex-wrap">
          <TabsTrigger value="all" className="flex flex-col h-auto p-2">
            <span>Overall Summary</span>
            <span className="font-bold text-primary">{formatCurrency(allBalance)}</span>
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
                    <span className="font-bold text-primary">{formatCurrency(primaryAccount.balance + cashWalletBalance + digitalWalletBalance)}</span>
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
          <ReportView transactions={transactions} categories={categories} accounts={accounts} isOverallSummary={true} />
        </TabsContent>
        
        {accounts.map(account => (
          <TabsContent key={account.id} value={account.id} className="mt-6">
            <ReportView 
                transactions={transactions} 
                categories={categories}
                accounts={accounts}
                isOverallSummary={false} 
                accountId={account.id}
                isPrimaryReport={!!account.isPrimary}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
