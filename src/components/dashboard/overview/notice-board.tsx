
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, FileText, BadgeCheck, Gift, Calendar as CalendarIcon } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Bill } from "@/lib/data";
import { useState, useEffect } from "react";
import { formatDistanceToNow, isAfter, subDays, isWithinInterval, startOfToday, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };


export function NoticeBoard() {
  const [user] = useAuthState(auth);
  const [specialEvents, setSpecialEvents] = useState<Bill[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (user && db) {
      const fiveDaysFromNow = subDays(new Date(), -5);
      const today = startOfToday();

      const q = query(
        collection(db, "bills"),
        where("userId", "==", user.uid),
        where("dueDate", ">=", today.toISOString()),
        orderBy("dueDate", "asc")
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allEvents = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Bill));
        
        const events = allEvents.filter(event => 
            event.type === 'special_day' && isWithinInterval(new Date(event.dueDate), { start: today, end: fiveDaysFromNow })
        );

        const bills = allEvents.filter(event => {
            if (event.type !== 'bill' || event.paidOn) return false;
            return true;
        });

        setSpecialEvents(events);
        setUpcomingBills(bills);
      });
      return () => unsubscribe();
    }
  }, [user, db]);

  const billContent = upcomingBills.map((event, index) => {
    return (
      <Alert key={`${event.id}-${index}`} className="border-l-primary border-l-4">
        <FileText className="h-4 w-4" />
        <AlertTitle className="flex justify-between">
          <span>{event.title}</span>
          <span className="text-muted-foreground font-normal">
            {formatDistanceToNow(new Date(event.dueDate), { addSuffix: true })}
          </span>
        </AlertTitle>
        <AlertDescription>
           Your payment of {formatCurrency(event.amount)} is due soon.
        </AlertDescription>
      </Alert>
    );
  });

  return (
    <Card className="lg:col-span-3 h-[900px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <span>Notice Board</span>
        </CardTitle>
        <CardDescription>A feed of your upcoming bills and special events.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col gap-4">
        {/* Special Events Section */}
        <div className="h-[250px] flex flex-col">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><Gift className="h-5 w-5 text-amber-500" />Upcoming Special Events</h3>
            <Separator />
            <div className="flex-1 pt-2">
                {specialEvents.length > 0 ? (
                    <div className="space-y-2">
                        {specialEvents.map(event => (
                            <Alert key={event.id} variant="default" className="bg-amber-50 border-amber-200">
                                <CalendarIcon className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800 flex justify-between">
                                <span>{event.title}</span>
                                <span className="text-amber-700 font-normal">
                                    {formatDistanceToNow(new Date(event.dueDate), { addSuffix: true })}
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
            </div>
        </div>

        {/* Upcoming Bills Section */}
        <div className="flex-1 min-h-0 flex flex-col">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-2"><FileText className="h-5 w-5 text-primary" />Upcoming Bills</h3>
            <Separator />
             <div className="flex-1 pt-2 min-h-0">
                {upcomingBills.length > 0 ? (
                    <ScrollArea className="h-full pr-4">
                        <div className="space-y-4">
                        {billContent}
                        </div>
                    </ScrollArea>
                ) : (
                    <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                        <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
                        <p>No upcoming bills. You're all caught up!</p>
                    </div>
                )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
