
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { format, startOfDay, getYear, getMonth, isSameDay } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function OverviewChart() {
  const [user] = useAuthState(auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isPickerOpen, setIsPickerOpen] = useState(false);


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

  const transactionsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return transactions.filter(t => isSameDay(new Date(t.date), selectedDate));
  }, [transactions, selectedDate]);

  const monthlyChartData = useMemo(() => {
    const currentYear = getYear(new Date());
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({ month: format(new Date(currentYear, i), 'MMM'), total: 0 }));

    transactions.forEach(t => {
      const transactionDate = new Date(t.date);
      if (getYear(transactionDate) === currentYear) {
        const monthIndex = getMonth(transactionDate);
        monthlyTotals[monthIndex].total += t.amount;
      }
    });

    return monthlyTotals;
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
        <CardTitle>Daily & Monthly Expense Overview</CardTitle>
        <CardDescription>
          Select a day to see detailed expenses for that date.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6">
        <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
                <Button
                variant={"outline"}
                className={cn(
                    "w-[280px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <TooltipProvider>
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                            setSelectedDate(date);
                            setIsPickerOpen(false);
                        }}
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
                        initialFocus
                    />
                </TooltipProvider>
            </PopoverContent>
        </Popover>

        {transactionsOnSelectedDate.length > 0 && (
           <div className="w-full">
                <h3 className="text-md font-medium mb-2 text-center">
                    Expenses for {format(selectedDate!, "MMMM dd, yyyy")}
                </h3>
                <ScrollArea className="h-40 w-full">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactionsOnSelectedDate.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{t.description}</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
           </div>
        )}

        <div className="w-full">
            <h3 className="text-md font-medium mb-4 text-center">
                Monthly Expenses for {getYear(new Date())}
            </h3>
            <ChartContainer config={{}} className="h-[200px] w-full">
                <BarChart accessibilityLayer data={monthlyChartData}>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value/1000}k`} />
                    <ChartTooltip 
                      cursor={false}
                      content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />}
                    />
                    <Bar dataKey="total" fill="var(--color-chart-1)" radius={4} />
                </BarChart>
            </ChartContainer>
        </div>
      </CardContent>
    </Card>
  );
}
