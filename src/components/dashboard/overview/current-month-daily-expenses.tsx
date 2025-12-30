
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, isWithinInterval, getDate, getMonth, getYear } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Coins } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function CurrentMonthDailyExpenses() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user && db) {
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("type", "==", "expense")
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        setDataLoading(false);
      });

      return () => unsubscribeTransactions();
    } else if (!user && !userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, db]);

  const dailyExpenses = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);

    const expensesForMonth = transactions.filter(t => 
        isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })
    );

    const expensesByDay: { [day: number]: number } = {};
    expensesForMonth.forEach(t => {
      const dayOfMonth = getDate(new Date(t.date));
      expensesByDay[dayOfMonth] = (expensesByDay[dayOfMonth] || 0) + t.amount;
    });

    return Object.entries(expensesByDay)
      .map(([day, total]) => ({ day: parseInt(day, 10), total }))
      .sort((a, b) => a.day - b.day);
  }, [transactions]);

  const grandTotal = useMemo(() => {
    return dailyExpenses.reduce((sum, item) => sum + item.total, 0);
  }, [dailyExpenses]);

  if (userLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Current Month's Daily Expenses</CardTitle>
        <CardDescription>
          A summary of your total expenses for each day of {format(new Date(), 'MMMM yyyy')}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {dailyExpenses.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 flex flex-col items-center">
            <Coins className="h-10 w-10 mb-2"/>
            <p>No expenses recorded for this month yet.</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Expense</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyExpenses.map(({ day, total }) => (
                  <TableRow key={day}>
                    <TableCell className="font-medium">{format(new Date(getYear(new Date()), getMonth(new Date()), day), 'MMMM dd, yyyy')}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
      {dailyExpenses.length > 0 && (
         <CardFooter className="pt-6 border-t">
            <div className="flex justify-between items-center w-full font-bold text-lg">
                <span>Month Total</span>
                <span>{formatCurrency(grandTotal)}</span>
            </div>
        </CardFooter>
      )}
    </Card>
  );
}
