"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, startOfDay } from "date-fns";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function OverviewChart() {
  const [user] = useAuthState(auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (user && db) {
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("type", "==", "expense")
      );
      const unsubscribeTransactions = onSnapshot(
        transactionsQuery,
        (snapshot) => {
          setTransactions(
            snapshot.docs.map(
              (doc) => ({ id: doc.id, ...doc.data() } as Transaction)
            )
          );
        },
        (error) => {
        }
      );
      return () => unsubscribeTransactions();
    }
  }, [user, db]);

  const dailyExpenses = useMemo(() => {
    return transactions.reduce((acc, t) => {
      const date = format(startOfDay(new Date(t.date)), "yyyy-MM-dd");
      if (!acc[date]) {
        acc[date] = 0;
      }
      acc[date] += t.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [transactions]);

  const DayWithTooltip = ({
    date,
    displayMonth,
  }: {
    date: Date;
    displayMonth: Date;
  }) => {
    const dateString = format(date, "yyyy-MM-dd");
    const expenseTotal = dailyExpenses[dateString];

    if (!expenseTotal) {
      return <div>{format(date, "d")}</div>;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative h-full w-full flex items-center justify-center rounded-full font-bold",
              "bg-accent text-accent-foreground"
            )}
          >
            {format(date, "d")}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatCurrency(expenseTotal)}</p>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Daily Expense Overview</CardTitle>
        <CardDescription>
          Hover over a highlighted day to see total expenses.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <TooltipProvider>
          <Calendar
            modifiers={{
              withExpenses: (date) => {
                const dateString = format(startOfDay(date), "yyyy-MM-dd");
                return !!dailyExpenses[dateString];
              },
            }}
            modifiersClassNames={{
              withExpenses: "bg-accent/30 rounded-full",
            }}
            components={{
              DayContent: DayWithTooltip,
            }}
          />
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
