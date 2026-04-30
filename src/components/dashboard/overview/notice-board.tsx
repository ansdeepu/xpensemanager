
"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, FileText, BadgeCheck, Gift, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Bill, Transaction } from "@/lib/data";
import { formatDistanceToNow, startOfToday, addDays, parseISO, isValid, isBefore, addMonths, addQuarters, addYears, getYear, setYear, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
};

export function NoticeBoard() {
  const [user] = useAuthState();
  const [allEvents, setAllEvents] = useState<Bill[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [clientDate, setClientDate] = useState<Date>(new Date());

  useEffect(() => {
    setClientDate(new Date());
  }, []);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "bills"),
        where("userId", "==", user.uid),
        orderBy("dueDate", "asc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Bill));
        setAllEvents(events);
      });

      const txQuery = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid)
      );
      const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
        const txs = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Transaction));
        setAllTransactions(txs);
      });

      return () => {
          unsubscribe();
          unsubscribeTx();
      };
    }
  }, [user]);

  const { upcomingBills, specialEvents } = useMemo(() => {
    const today = startOfDay(clientDate);
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const fiveDaysFromNow = addDays(today, 5);

    const upcoming: { event: Bill, nextDueDate: Date, isOverdue: boolean }[] = [];
    const special: { event: Bill, celebrationDate: Date }[] = [];

    allEvents.forEach(event => {
      const originalDueDate = parseISO(event.dueDate);
      if (!isValid(originalDueDate)) return;

      if (event.type === 'bill') {
        const isPaidThisMonth = allTransactions.some(t => {
            if (t.type !== 'expense') return false;
            const d = new Date(t.date);
            if (!isValid(d) || !isWithinInterval(d, { start: monthStart, end: monthEnd })) return false;
            
            const matchesTopLevel = (t.categoryId === event.categoryId || t.category === event.category) && t.subcategory === event.subcategory;
            if (matchesTopLevel) return true;
            if (t.items && t.items.length > 0) {
                return t.items.some(item => (item.categoryId === event.categoryId || item.category === event.category) && item.subcategory === event.subcategory);
            }
            return false;
        });

        if (isPaidThisMonth) return;

        let nextDueDate = originalDueDate;
        // Logic: Find the specific occurrence of this bill that falls within the current month
        if (event.recurrence && event.recurrence !== 'none' && event.recurrence !== 'occasional') {
            while (isBefore(nextDueDate, monthStart)) {
                switch(event.recurrence) {
                    case 'monthly': nextDueDate = addMonths(nextDueDate, 1); break;
                    case 'quarterly': nextDueDate = addQuarters(nextDueDate, 1); break;
                    case 'yearly': nextDueDate = addYears(nextDueDate, 1); break;
                    default: nextDueDate = addMonths(nextDueDate, 1);
                }
            }
        }

        // Strictly bound the display to the current month ONLY
        if (isWithinInterval(nextDueDate, { start: monthStart, end: monthEnd })) {
            upcoming.push({ 
                event, 
                nextDueDate, 
                isOverdue: isBefore(nextDueDate, today) 
            });
        }
      } else if (event.type === 'special_day') {
          const currentYear = getYear(today);
          let celebrationDate = setYear(originalDueDate, currentYear);
          if (isBefore(celebrationDate, today)) {
              celebrationDate = addYears(celebrationDate, 1);
          }
          if (isWithinInterval(celebrationDate, { start: today, end: fiveDaysFromNow })) {
              special.push({ event, celebrationDate });
          }
      }
    });
    
    upcoming.sort((a,b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
    special.sort((a,b) => a.celebrationDate.getTime() - b.celebrationDate.getTime());

    return { upcomingBills: upcoming, specialEvents: special };
  }, [allEvents, allTransactions, clientDate]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <span>Notice Board</span>
        </CardTitle>
        <CardDescription>A feed of your upcoming bills and special events for this month.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/2 flex flex-col">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><FileText className="h-5 w-5 text-primary" />Upcoming Bills</h3>
            <Separator />
             <div className="flex-1 pt-2 min-h-0">
                {upcomingBills.length > 0 ? (
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                          {upcomingBills.map(({ event, nextDueDate, isOverdue }) => (
                            <Alert key={event.id} className={cn("border-l-4", isOverdue ? "border-l-destructive bg-destructive/5" : "border-l-primary")}>
                              {isOverdue ? <AlertCircle className="h-4 w-4 text-destructive" /> : <FileText className="h-4 w-4" />}
                              <AlertTitle className="flex justify-between items-start gap-2">
                                <span className={cn("font-bold", isOverdue && "text-destructive")}>{event.title}</span>
                                <span className={cn("text-[10px] whitespace-nowrap px-1.5 py-0.5 rounded-full", isOverdue ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground")}>
                                  {isOverdue ? "Overdue" : formatDistanceToNow(nextDueDate, { addSuffix: true })}
                                </span>
                              </AlertTitle>
                              <AlertDescription className="mt-1">
                                 <div className="flex justify-between items-center">
                                     <span className="text-sm">Payment of <span className="font-bold">{formatCurrency(event.amount)}</span></span>
                                     <span className="text-[10px] opacity-70">Due: {nextDueDate.getDate()} {nextDueDate.toLocaleString('default', { month: 'short' })}</span>
                                 </div>
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                        <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
                        <p>No upcoming bills for the remainder of this month.</p>
                    </div>
                )}
            </div>
        </div>

        <Separator orientation="vertical" className="hidden lg:block mx-3" />
        <Separator className="lg:hidden" />

        <div className="lg:w-1/2 flex flex-col">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><Gift className="h-5 w-5 text-amber-500" />Upcoming Special Events</h3>
            <Separator />
            <ScrollArea className="flex-1 pt-2 pr-4">
                {specialEvents.length > 0 ? (
                    <div className="space-y-2">
                        {specialEvents.map(({ event, celebrationDate }) => (
                            <Alert key={event.id} variant="default" className="bg-amber-50 border-amber-200">
                                <CalendarIcon className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800 flex justify-between">
                                <span>{event.title}</span>
                                <span className="text-amber-700 font-normal">
                                    {formatDistanceToNow(celebrationDate, { addSuffix: true })}
                                </span>
                                </AlertTitle>
                                <AlertDescription className="text-amber-700">
                                    This special day is just around the corner!
                                </AlertDescription>
                            </Alert>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                        <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
                        <p>No special events in the next 5 days.</p>
                    </div>
                )}
            </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
