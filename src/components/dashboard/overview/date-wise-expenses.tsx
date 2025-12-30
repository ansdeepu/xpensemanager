
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function DateWiseExpenses() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
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
    } else if (!user && !userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { primaryAccount, otherAccounts } = useMemo(() => {
    const primary = accounts.find(a => a.isPrimary);
    const others = accounts.filter(a => !a.isPrimary);
    return { primaryAccount: primary, otherAccounts: others };
  }, [accounts]);

  const expensesForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    
    // Normalize selectedDate to the start of the day in local time.
    const targetDate = startOfDay(new Date(selectedDate));
    const targetDateString = format(targetDate, 'yyyy-MM-dd');

    return transactions.filter(t => {
      if (t.type !== 'expense') return false;
      // Normalize transaction date to the start of its day in local time.
      const transactionDate = startOfDay(new Date(t.date));
      const transactionDateString = format(transactionDate, 'yyyy-MM-dd');
      
      return transactionDateString === targetDateString;
    });
  }, [transactions, selectedDate]);

  const groupedExpenses = useMemo(() => {
    const groups: {
      primary: Transaction[];
      others: Transaction[];
      cash: Transaction[];
      digital: Transaction[];
    } = { primary: [], others: [], cash: [], digital: [] };

    expensesForSelectedDate.forEach(t => {
      if (t.paymentMethod === 'cash') {
        groups.cash.push(t);
      } else if (t.paymentMethod === 'digital') {
        groups.digital.push(t);
      } else if (t.accountId === primaryAccount?.id) {
        groups.primary.push(t);
      } else {
        groups.others.push(t);
      }
    });

    return groups;
  }, [expensesForSelectedDate, primaryAccount]);

  const totals = useMemo(() => {
    return {
      primary: groupedExpenses.primary.reduce((sum, t) => sum + t.amount, 0),
      others: groupedExpenses.others.reduce((sum, t) => sum + t.amount, 0),
      cash: groupedExpenses.cash.reduce((sum, t) => sum + t.amount, 0),
      digital: groupedExpenses.digital.reduce((sum, t) => sum + t.amount, 0),
    };
  }, [groupedExpenses]);

  if (userLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const renderExpenseTable = (title: string, transactions: Transaction[], total: number) => (
    (transactions.length > 0 || title.includes("Primary")) && (
      <div className="pt-4">
        <h4 className="font-semibold mb-2">{title} Expenses</h4>
        {transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.description}</TableCell>
                  <TableCell>{t.category}{t.subcategory ? ` / ${t.subcategory}` : ''}</TableCell>
                  <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
                <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : <p className="text-sm text-muted-foreground text-center py-4">No expenses for {title.toLowerCase()} on this day.</p>}
      </div>
    )
  );

  const grandTotal = totals.primary + totals.others + totals.cash + totals.digital;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date-wise Expenses</CardTitle>
        <CardDescription>Select a date to see a breakdown of your expenses for that day.</CardDescription>
        <div className="flex items-center gap-2 pt-2">
          <Label htmlFor="expense-date" className="flex-shrink-0">Select Date:</Label>
          <Input
            id="expense-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-auto"
          />
        </div>
      </CardHeader>
      <CardContent>
        {expensesForSelectedDate.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
                <p>No expenses recorded on {format(new Date(selectedDate), 'PPP')}.</p>
            </div>
        ) : (
          <>
            {primaryAccount && renderExpenseTable(`Primary Account (${primaryAccount.name})`, groupedExpenses.primary, totals.primary)}
            {renderExpenseTable("Other Bank Accounts", groupedExpenses.others, totals.others)}
            {renderExpenseTable("Cash Wallet", groupedExpenses.cash, totals.cash)}
            {renderExpenseTable("Digital Wallet", groupedExpenses.digital, totals.digital)}
            
            <div className="border-t mt-6 pt-4">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
