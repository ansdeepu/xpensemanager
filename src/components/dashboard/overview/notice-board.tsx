
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bell, FileText, BadgeCheck, Gift } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Bill } from "@/lib/data";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };


export function NoticeBoard() {
  const [user] = useAuthState(auth);
  const [upcomingEvents, setUpcomingEvents] = useState<Bill[]>([]);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "bills"),
        where("userId", "==", user.uid),
        orderBy("dueDate", "asc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()} as Bill))
        .filter(event => {
            // Filter out paid bills, but keep all special days
            if (event.type === 'special_day') return true;
            return !event.paidOn;
        });
        setUpcomingEvents(events);
      });
      return () => unsubscribe();
    }
  }, [user, db]);

  const noticeBoardContent = upcomingEvents.map((event, index) => {
    return (
      <Alert key={`${event.id}-${index}`}>
        {event.type === 'special_day' ? <Gift className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        <AlertTitle className="flex justify-between">
          <span>{event.title}</span>
          <span className="text-muted-foreground font-normal">
            {formatDistanceToNow(new Date(event.dueDate), { addSuffix: true })}
          </span>
        </AlertTitle>
        <AlertDescription>
          {event.type === 'bill' 
            ? `Your payment of ${formatCurrency(event.amount)} is due soon.`
            : `This special day is coming up!`}
        </AlertDescription>
      </Alert>
    );
  });

  return (
    <Card className="lg:col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <span>Notice Board</span>
        </CardTitle>
        <CardDescription>A feed of your upcoming bills and special events.</CardDescription>
      </CardHeader>
      <CardContent>
        {upcomingEvents.length > 0 ? (
           <div 
              className="h-48 overflow-hidden relative"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
           >
              <div 
                className={cn(
                  "space-y-4 absolute top-0 left-0 animate-scroll",
                  isHovered && "animation-pause"
                )}
                style={{ '--animation-duration': `${upcomingEvents.length * 5}s` } as React.CSSProperties}
              >
                  {/* Render items twice for seamless scrolling */}
                  {noticeBoardContent}
                  {noticeBoardContent}
              </div>
           </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-48">
            <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
            <p>No upcoming reminders. You're all caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
