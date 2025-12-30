
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterComponent,
  DialogClose,
} from "@/components/ui/dialog";
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
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, setDate, isSameDay } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type DailyDetail = {
    day: number;
    total: number;
    transactions: Transaction[];
}

export function CurrentMonthDailyExpenses() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDayDetail, setSelectedDayDetail] = useState<DailyDetail | null>(null);

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

    const expensesByDay: { [day: number]: { total: number, transactions: Transaction[]} } = {};
    expensesForMonth.forEach(t => {
      const dayOfMonth = new Date(t.date).getDate();
      if (!expensesByDay[dayOfMonth]) {
          expensesByDay[dayOfMonth] = { total: 0, transactions: [] };
      }
      expensesByDay[dayOfMonth].total += t.amount;
      expensesByDay[dayOfMonth].transactions.push(t);
    });

    const daysInMonth = getDaysInMonth(today);
    const result: DailyDetail[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
        result.push({ 
            day: i, 
            total: expensesByDay[i]?.total || 0,
            transactions: expensesByDay[i]?.transactions || []
        });
    }

    return result;
  }, [transactions]);

  const grandTotal = useMemo(() => {
    return dailyExpenses.reduce((sum, item) => sum + item.total, 0);
  }, [dailyExpenses]);

  const handleDayClick = (dayDetail: DailyDetail) => {
    if (dayDetail.total > 0) {
      setSelectedDayDetail(dayDetail);
      setIsDetailDialogOpen(true);
    }
  };


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
    <>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {dailyExpenses.map((detail) => (
                    <Card key={detail.day} className="flex flex-col text-center">
                        <CardHeader className="flex flex-row items-center justify-center p-3">
                            <CardTitle className="text-xl font-bold">{detail.day}</CardTitle>
                        </CardHeader>
                         <CardContent className="p-3 pt-0 flex-1">
                             <div 
                                className={cn("text-lg font-bold", detail.total > 0 && "cursor-pointer hover:underline")}
                                onClick={() => handleDayClick(detail)}
                            >
                                {formatCurrency(detail.total)}
                            </div>
                        </CardContent>
                    </Card>
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

    <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Expenses for {selectedDayDetail ? format(setDate(new Date(), selectedDayDetail.day), 'MMMM dd, yyyy') : ''}</DialogTitle>
          <DialogDescription>
            A detailed list of all expenses for this day.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-6">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedDayDetail && selectedDayDetail.transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <p className="font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category}{t.subcategory ? ` / ${t.subcategory}` : ''}</p>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(t.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter className="sticky bottom-0 bg-background">
                <TableRow>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right font-bold">{formatCurrency(selectedDayDetail?.total || 0)}</TableHead>
                </TableRow>
              </TableFooter>
            </Table>
          </ScrollArea>
        </div>
        <DialogFooterComponent className="pt-4">
          <DialogClose asChild>
            <Button type="button" variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooterComponent>
      </DialogContent>
    </Dialog>
    </>
  );
}
