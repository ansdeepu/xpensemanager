"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { useEffect, useState } from "react";

export function OverviewChart() {
  const [user] = useAuthState(auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    if (user && db) {
      const transactionsQuery = query(
        collection(db, "transactions"), 
        where("userId", "==", user.uid),
        orderBy("date", "desc")
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      }, (error) => {
      });
      return () => unsubscribeTransactions();
    }
  }, [user, db]);

  // Simple aggregation for chart data
  const data = transactions.reduce((acc, t) => {
    if (t.type === 'income' || t.type === 'expense') {
        const day = new Date(t.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short'});
        let entry = acc.find(e => e.name === day);
        if (!entry) {
            entry = { name: day, income: 0, expenses: 0 };
            acc.push(entry);
        }
        if (t.type === 'income') {
            entry.income += t.amount;
        } else {
            entry.expenses += t.amount;
        }
    }
    return acc;
  }, [] as {name: string, income: number, expenses: number}[]).reverse(); // reverse to show chronologically


  return (
    <Card className="lg:col-span-4">
      <CardHeader>
        <CardTitle>Overview</CardTitle>
        <CardDescription>Your income and expenses for this month.</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data}>
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              cursor={{fill: 'hsl(var(--muted))'}}
              contentStyle={{backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)'}} 
            />
            <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
