
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from "@/components/ui/table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Account } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { isSameDay, parseISO, format } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";
import { Banknote, BadgeCheck } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function DayWiseExpenses() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      });

      const transactionsQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid)
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        if(dataLoading) setDataLoading(false);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!user) {
        if(dataLoading) setDataLoading(false);
    }
  }, [user, db, dataLoading]);

  const { primaryAccountExpenses, otherBankExpenses, totalPrimary, totalOther } = useMemo(() => {
    if (!selectedDate) {
      return { primaryAccountExpenses: [], otherBankExpenses: [], totalPrimary: 0, totalOther: 0 };
    }

    // By parsing the date string directly, we get a Date object at midnight in the local timezone.
    const dateToFilter = new Date(selectedDate);
     // The timezoneOffset ensures that when we create the date, it is interpreted as local time, not UTC.
    const timezoneOffset = dateToFilter.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(dateToFilter.getTime() + timezoneOffset);

    const dailyTransactions = transactions.filter(t => 
        t.type === 'expense' && 
        t.paymentMethod === 'online' && 
        isSameDay(parseISO(t.date), adjustedDate)
    );
    
    const primaryAccount = accounts.find(acc => acc.isPrimary);
    
    const expenses: { [accountId: string]: { name: string; isPrimary: boolean; total: number; transactions: Transaction[] } } = {};

    accounts.forEach(acc => {
        expenses[acc.id] = { name: acc.name, isPrimary: !!acc.isPrimary, total: 0, transactions: [] };
    });

    dailyTransactions.forEach(t => {
      if (t.accountId && expenses[t.accountId]) {
        expenses[t.accountId].total += t.amount;
        expenses[t.accountId].transactions.push(t);
      }
    });

    const primaryAccountExpenses = primaryAccount && expenses[primaryAccount.id]?.total > 0 ? [{...expenses[primaryAccount.id], id: primaryAccount.id }] : [];
    const otherBankExpenses = Object.entries(expenses)
        .filter(([id, data]) => !data.isPrimary && data.total > 0)
        .map(([id, data]) => ({...data, id}));

    const totalPrimary = primaryAccountExpenses.reduce((sum, exp) => sum + exp.total, 0);
    const totalOther = otherBankExpenses.reduce((sum, exp) => sum + exp.total, 0);
    
    return { primaryAccountExpenses, otherBankExpenses, totalPrimary, totalOther };

  }, [transactions, accounts, selectedDate]);

  if (userLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasPrimaryExpenses = primaryAccountExpenses.length > 0;
  const hasOtherExpenses = otherBankExpenses.length > 0;
  const hasAnyExpenses = hasPrimaryExpenses || hasOtherExpenses;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="flex items-center gap-2">
                    <Banknote />
                    Day-wise Bank Expenses
                </CardTitle>
                <CardDescription>Select a date to view expenses from your bank accounts.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
                <Label htmlFor="expense-date" className="sr-only">Select Date</Label>
                <Input 
                    id="expense-date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full sm:w-auto"
                />
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {hasAnyExpenses ? (
            <div className="space-y-6">
                {hasPrimaryExpenses && (
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Primary Account</h3>
                        {primaryAccountExpenses.map(expense => (
                             <Table key={expense.id}>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60%]">Description ({expense.name})</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {expense.transactions.map(t => (
                                        <TableRow key={t.id}>
                                            <TableCell>{t.description}</TableCell>
                                            <TableCell className="text-muted-foreground">{t.subcategory || t.category}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableHead colSpan={2}>Total</TableHead>
                                        <TableHead className="text-right font-bold">{formatCurrency(expense.total)}</TableHead>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        ))}
                    </div>
                )}
                 {hasPrimaryExpenses && hasOtherExpenses && <Separator />}
                 {hasOtherExpenses && (
                    <div>
                         <h3 className="text-lg font-semibold mb-2">Other Banks</h3>
                         <div className="space-y-4">
                            {otherBankExpenses.map(expense => (
                                <Table key={expense.id}>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[60%]">Description ({expense.name})</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {expense.transactions.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell>{t.description}</TableCell>
                                                <TableCell className="text-muted-foreground">{t.subcategory || t.category}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableHead colSpan={2}>Total</TableHead>
                                            <TableHead className="text-right font-bold">{formatCurrency(expense.total)}</TableHead>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            ))}
                         </div>
                    </div>
                 )}
            </div>
        ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-24">
                <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
                <p>No bank expenses recorded for the selected date.</p>
            </div>
        )}
      </CardContent>
       {hasAnyExpenses && (
            <CardFooter className="pt-6">
                <div className="w-full flex justify-between font-bold text-lg">
                    <span>Grand Total</span>
                    <span className="text-red-600">{formatCurrency(totalPrimary + totalOther)}</span>
                </div>
            </CardFooter>
       )}
    </Card>
  );
}
