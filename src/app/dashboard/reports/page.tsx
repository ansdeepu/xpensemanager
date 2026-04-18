
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import type { Account, Transaction, Category, Loan } from "@/lib/data";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportView } from "@/components/dashboard/reports/report-view";
import { useAuthState } from "@/hooks/use-auth-state";
import { isAfter, parseISO, format } from "date-fns";
import { useReportDate } from "@/context/report-date-context";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";


const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(val);
};

export default function ReportsPage() {
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { currentDate, goToPreviousMonth, goToNextMonth } = useReportDate();

  useEffect(() => {
    if (user) {
      setDataLoading(true);
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>));
        setRawAccounts(userAccounts);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      });
      
      const loansQuery = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribeLoans = onSnapshot(loansQuery, (snapshot) => {
          const userLoans = snapshot.docs.map((doc) => {
          const data = doc.data();
          const transactions = data.transactions || [];
          const totalLoan = transactions.filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
          const totalRepayment = transactions.filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
          return {
            id: doc.id,
            ...data,
            transactions,
            totalLoan,
            totalRepayment,
            balance: totalLoan - totalRepayment,
          } as Loan;
        });
        setLoans(userLoans);
        setDataLoading(false);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
        unsubscribeLoans();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading]);

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    let cashBalance = 0;
    let digitalBalance = 0;
    const balances: { [key: string]: number } = {};
    const accountMap = new Map(rawAccounts.map(acc => [acc.id, acc]));

    rawAccounts.forEach(acc => {
        balances[acc.id] = 0;
    });

    const chronologicalTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chronologicalTransactions.forEach(t => {
      if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
          const account = accountMap.get(t.accountId);
          if (account?.type !== 'card') {
            balances[t.accountId] += t.amount;
          }
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && balances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if (account?.type === 'card') {
              balances[t.accountId] += t.amount; 
            } else {
              balances[t.accountId] -= t.amount;
            }
        } else if (t.paymentMethod === 'cash') {
          cashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          digitalBalance -= t.amount;
        }
      } else if (t.type === 'transfer') {
        if (t.fromAccountId && balances[t.fromAccountId] !== undefined) {
          const fromAccount = accountMap.get(t.fromAccountId);
          if (fromAccount?.type === 'card') {
            balances[t.fromAccountId] += t.amount;
          } else {
            balances[t.fromAccountId] -= t.amount;
          }
        } else if (t.fromAccountId === 'cash-wallet') {
          cashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          digitalBalance -= t.amount;
        }

        if (t.toAccountId && balances[t.toAccountId] !== undefined) {
           const toAccount = accountMap.get(t.toAccountId);
           if (toAccount?.type === 'card') {
             balances[t.toAccountId] -= t.amount;
           } else {
             balances[t.toAccountId] += t.amount;
           }
        } else if (t.toAccountId === 'cash-wallet') {
          cashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          digitalBalance += t.amount;
        }
      }
    });

    return { 
      accountBalances: balances, 
      cashWalletBalance: cashBalance,
      digitalWalletBalance: digitalBalance 
    };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts
      .map(acc => ({
          ...acc,
          balance: accountBalances[acc.id] ?? 0,
      }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
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
  
  // Ecosystem Total = Sum of all non-card assets + wallets (excludes credit card debt)
  const allBalance = accounts.reduce((sum, acc) => {
      if (acc.type === 'card') return sum; 
      return sum + acc.balance;
  }, 0) + cashWalletBalance + digitalWalletBalance;

  // Filter out Credit Card tab as requested
  const filteredAccounts = accounts.filter(acc => acc.type !== 'card');

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Monthly Reports</CardTitle>
                    <CardDescription>An overview of your finances for the selected month.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-28 text-center">{format(currentDate, "MMMM yyyy")}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
        </Card>
      <Tabs defaultValue={primaryAccount?.id || 'all'} className="w-full">
        <TabsList className="flex w-full overflow-x-auto h-auto p-1">
          <TabsTrigger value="all" className="flex-shrink-0 flex flex-col h-auto p-2">
            <span>Overall Summary</span>
            <span className={cn("font-bold", allBalance >= 0 ? 'text-primary' : 'text-red-600')}>{formatCurrency(allBalance)}</span>
          </TabsTrigger>
          {primaryAccount && (
            <TabsTrigger value={primaryAccount.id} className="flex-shrink-0 flex flex-col h-auto p-2 items-start text-left min-w-64">
              <span className="font-semibold text-sm">Primary ({primaryAccount.name})</span>
              <div className="w-full text-xs text-muted-foreground mt-1">
                  <div className="flex justify-between items-center">
                    <span>Bank Balance: {formatCurrency(primaryAccount.balance)}</span>
                    <span>Wallets: {formatCurrency(cashWalletBalance + digitalWalletBalance)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1 border-t pt-1">
                    <span>Ecosystem Total:</span>
                    <span className="font-bold text-primary">{formatCurrency(primaryAccount.balance + cashWalletBalance + digitalWalletBalance)}</span>
                  </div>
              </div>
            </TabsTrigger>
          )}
          {filteredAccounts.filter(account => !account.isPrimary).map(account => (
            <TabsTrigger key={account.id} value={account.id} className="flex-shrink-0 flex flex-col h-auto p-2">
              <span>{account.name}</span>
              <span className="font-bold text-primary">{formatCurrency(account.balance)}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <ReportView transactions={transactions} categories={categories} accounts={accounts} loans={loans} isOverallSummary={true} />
        </TabsContent>
        
        {accounts.map(account => (
          <TabsContent key={account.id} value={account.id} className="mt-6">
            <ReportView 
                transactions={transactions} 
                categories={categories}
                accounts={accounts}
                loans={loans}
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
