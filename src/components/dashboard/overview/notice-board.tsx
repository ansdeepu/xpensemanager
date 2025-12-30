
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, FileText, BadgeCheck, Gift, Calendar as CalendarIcon } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Bill } from "@/lib/data";
import { useState, useEffect, useMemo } from "react";
import { formatDistanceToNow, isAfter, subDays, isWithinInterval, startOfToday, endOfDay, addDays, parseISO, isValid, isBefore, addMonths, addQuarters, addYears, getYear, setYear } from "date-fns";
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
  const [user] = useAuthState(auth);
  const [allEvents, setAllEvents] = useState<Bill[]>([]);
  const [isHovered, setIsHovered] = useState(false);

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
      return () => unsubscribe();
    }
  }, [user, db]);

  const { upcomingBills, specialEvents } = useMemo(() => {
    const today = startOfToday();
    const tenDaysFromNow = addDays(today, 10);
    const fiveDaysFromNow = addDays(today, 5);

    const upcomingBills: { event: Bill, nextDueDate: Date }[] = [];
    const specialEvents: { event: Bill, celebrationDate: Date }[] = [];

    allEvents.forEach(event => {
      const originalDueDate = parseISO(event.dueDate);
      if (!isValid(originalDueDate)) return;

      if (event.type === 'bill') {
        if (event.recurrence === 'occasional' || event.recurrence === 'none' || !event.recurrence) {
            if (!event.paidOn && isWithinInterval(originalDueDate, { start: today, end: tenDaysFromNow })) {
                upcomingBills.push({ event, nextDueDate: originalDueDate });
            }
        } else { // Recurring bills
            let nextDueDate = originalDueDate;
            while (isBefore(nextDueDate, today)) {
                switch(event.recurrence) {
                    case 'monthly': nextDueDate = addMonths(nextDueDate, 1); break;
                    case 'quarterly': nextDueDate = addQuarters(nextDueDate, 1); break;
                    case 'yearly': nextDueDate = addYears(nextDueDate, 1); break;
                }
            }
            if (isWithinInterval(nextDueDate, { start: today, end: tenDaysFromNow })) {
                upcomingBills.push({ event, nextDueDate });
            }
        }
      } else if (event.type === 'special_day') {
          const currentYear = getYear(today);
          let celebrationDate = setYear(originalDueDate, currentYear);
          if (isBefore(celebrationDate, today)) {
              celebrationDate = addYears(celebrationDate, 1);
          }
          if (isWithinInterval(celebrationDate, { start: today, end: fiveDaysFromNow })) {
              specialEvents.push({ event, celebrationDate });
          }
      }
    });
    
    upcomingBills.sort((a,b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
    specialEvents.sort((a,b) => a.celebrationDate.getTime() - b.celebrationDate.getTime());

    return { upcomingBills, specialEvents };
  }, [allEvents]);


  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <span>Notice Board</span>
        </CardTitle>
        <CardDescription>A feed of your upcoming bills and special events.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        {/* Upcoming Bills Section */}
        <div className="lg:w-1/2 flex flex-col">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><FileText className="h-5 w-5 text-primary" />Upcoming Bills</h3>
            <Separator />
             <div className="flex-1 pt-2 min-h-0">
                {upcomingBills.length > 0 ? (
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                          {upcomingBills.map(({ event, nextDueDate }) => (
                            <Alert key={event.id} className="border-l-primary border-l-4">
                              <FileText className="h-4 w-4" />
                              <AlertTitle className="flex justify-between">
                                <span>{event.title}</span>
                                <span className="text-muted-foreground font-normal">
                                  {formatDistanceToNow(nextDueDate, { addSuffix: true })}
                                </span>
                              </AlertTitle>
                              <AlertDescription>
                                 Your payment of {formatCurrency(event.amount)} is due soon.
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                        <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
                        <p>No upcoming bills in the next 10 days. You're all caught up!</p>
                    </div>
                )}
            </div>
        </div>

        <Separator orientation="vertical" className="hidden lg:block mx-3" />
        <Separator className="lg:hidden" />

        {/* Special Events Section */}
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
