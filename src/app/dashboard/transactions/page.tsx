
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  if (Object.is(amount, -0)) {
    amount = 0;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

const tabColors = [
  "bg-sky-100 dark:bg-sky-900/50",
  "bg-amber-100 dark:bg-amber-900/50",
  "bg-emerald-100 dark:bg-emerald-900/50",
  "bg-rose-100 dark:bg-rose-900/50",
  "bg-violet-100 dark:bg-violet-900/50",
  "bg-cyan-100 dark:bg-cyan-900/50",
  "bg-fuchsia-100 dark:bg-fuchsia-900/50",
];

const textColors = [
  "text-sky-800 dark:text-sky-200",
  "text-amber-800 dark:text-amber-200",
  "text-emerald-800 dark:text-emerald-200",
  "text-rose-800 dark:text-rose-200",
  "text-violet-800 dark:text-violet-200",
  "text-cyan-800 dark:text-cyan-200",
  "text-fuchsia-800 dark:text-fuchsia-200",
];

export default function TransactionsPage() {
  const [user, userLoading] = useAuthState();
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

    return { 
      accountBalances: calculatedAccountBalances, 
      cashWalletBalance: calculatedCashWalletBalance,
      digitalWalletBalance: calculatedDigitalWalletBalance 
    };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0,
    }));
  }, [rawAccounts, accountBalances]);


  const primaryAccount = accounts.find(a => a.isPrimary);
  
  const secondaryAccounts = accounts.filter(account => !account.isPrimary && (account.name.toLowerCase().includes('hdfc') || account.name.toLowerCase().includes('fed') || account.name.toLowerCase().includes('post') || account.name.toLowerCase().includes('money')));
  const otherAccounts = accounts.filter(account => !account.isPrimary && !secondaryAccounts.some(sa => sa.id === account.id));


  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const allBalance = (primaryAccount ? primaryAccount.balance : 0) + cashWalletBalance + digitalWalletBalance;

  return (
    <div className="space-y-6">
      <Tabs defaultValue={primaryAccount?.id || "all-accounts"} className="w-full">
        <TabsList className="flex flex-wrap h-auto items-start p-0">
          <div className="w-full md:w-1/2 p-1">
            {primaryAccount && (
              <TabsTrigger value={primaryAccount.id} className={cn("border flex flex-col h-full p-4 items-start text-left gap-4 w-full", "bg-lime-100 dark:bg-lime-900/50")}>
                <div className="w-full flex justify-between">
                  <span className="font-semibold text-lg">Primary ({primaryAccount.name})</span>
                  <span className="font-bold text-2xl text-primary">{formatCurrency(allBalance)}</span>
                </div>
                
                <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left py-4">
                  {/* Bank Column */}
                  <div className="space-y-2">
                    <Label className="text-xs">Bank Balance</Label>
                    <div className="font-mono text-base">{formatCurrency(primaryAccount.balance)}</div>
                  </div>

                  {/* Cash Column */}
                  <div className="space-y-2">
                    <Label className="text-xs">Cash</Label>
                    <div className="font-mono text-base">{formatCurrency(cashWalletBalance)}</div>
                  </div>

                  {/* Digital Column */}
                  <div className="space-y-2">
                    <Label className="text-xs">Digital</Label>
                      <div className="font-mono text-base">{formatCurrency(digitalWalletBalance)}</div>
                  </div>
                </div>
              </TabsTrigger>
            )}
          </div>
          <div className="w-full md:w-1/2 flex flex-wrap justify-end">
            <div className="grid grid-cols-2 w-full p-1 gap-1">
            {secondaryAccounts.map((account, index) => {
              return (
                <TabsTrigger key={account.id} value={account.id} className={cn("border flex flex-col h-auto p-3 items-start text-left gap-2", tabColors[index % tabColors.length], textColors[index % textColors.length])}>
                    <div className="w-full flex justify-between items-center">
                        <span className="font-semibold text-sm">{account.name}</span>
                        <span className="font-bold">{formatCurrency(account.balance)}</span>
                    </div>
                </TabsTrigger>
            )})}
            {otherAccounts.map((account, index) => {
              return (
                <TabsTrigger key={account.id} value={account.id} className={cn("border flex flex-col h-auto p-3 items-start text-left gap-2", tabColors[(secondaryAccounts.length + index) % tabColors.length], textColors[(secondaryAccounts.length + index) % textColors.length])}>
                    <div className="w-full flex justify-between items-center">
                        <span className="font-semibold text-sm">{account.name}</span>
                        <span className="font-bold">{formatCurrency(account.balance)}</span>
                    </div>
                </TabsTrigger>
            )})}
            </div>
          </div>
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
