
"use client";

import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Pie, PieChart, Cell } from "recharts";
import { useAuthState } from "@/hooks/use-auth-state";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect } from "react";
import type { Transaction, Category } from "@/lib/data";
import { endOfMonth, isWithinInterval, startOfMonth } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag } from "lucide-react";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(220, 70%, 60%)",
  "hsl(340, 70%, 60%)",
  "hsl(40, 70%, 60%)",
];

export function ExpenseDistributionChart() {
  const [user, loading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user && db) {
      const transactionsQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("type", "==", "expense")
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Transaction)));
        setDataLoading(false);
      });

      return () => unsubscribeTransactions();
    } else if (!user) {
      setDataLoading(false);
    }
  }, [user, db]);

  const monthInterval = useMemo(() => ({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => isWithinInterval(new Date(t.date), monthInterval));
  }, [transactions, monthInterval]);

  const expenseByCategory = useMemo(() => {
    const categoryTotals: { [key: string]: number } = {};
    monthlyTransactions.forEach(t => {
      const categoryName = t.category || 'Uncategorized';
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + t.amount;
    });
    return Object.entries(categoryTotals).map(([name, value]) => ({ name, value, fill: CHART_COLORS[Object.keys(categoryTotals).indexOf(name) % CHART_COLORS.length] }));
  }, [monthlyTransactions]);

  if (loading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expense Distribution</CardTitle>
        <CardDescription>
          A visual breakdown of your spending by category this month.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {expenseByCategory.length > 0 ? (
          <ChartContainer config={{}} className="mx-auto aspect-square h-[250px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => `${formatCurrency(value as number)} (${((value as number / monthlyTransactions.reduce((acc, t) => acc + t.amount, 0)) * 100).toFixed(1)}%)`}
                    nameKey="name"
                  />
                }
              />
              <Pie
                data={expenseByCategory}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={60}
                paddingAngle={2}
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {expenseByCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        ) : (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-[250px]">
                <Tag className="h-10 w-10 mb-2"/>
                <p>No expenses recorded this month to display the chart.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
