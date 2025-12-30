
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
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

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
      const dayOfMonth = new Date(t.date).getDate();
      expensesByDay[dayOfMonth] = (expensesByDay[dayOfMonth] || 0) + t.amount;
    });

    const daysInMonth = getDaysInMonth(today);
    const result = [];
    for (let i = 1; i <= daysInMonth; i++) {
        result.push({ day: i, total: expensesByDay[i] || 0 });
    }

    return result;
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
        {grandTotal === 0 ? (
          <div className="text-center text-muted-foreground py-10 flex flex-col items-center">
            <Coins className="h-10 w-10 mb-2"/>
            <p>No expenses recorded for this month yet.</p>
          </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {dailyExpenses.map(({ day, total }) => (
                    <div key={day} className={cn("flex justify-between items-center p-2 rounded-md", total > 0 ? "bg-muted/50" : "bg-transparent")}>
                        <span className="text-sm font-medium text-muted-foreground">{day}</span>
                        <span className={cn("text-sm font-mono", total > 0 ? "text-foreground font-semibold" : "text-muted-foreground")}>{formatCurrency(total)}</span>
                    </div>
                ))}
            </div>
        )}
      </CardContent>
      {grandTotal > 0 && (
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
