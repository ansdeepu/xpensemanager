
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, FileText, BadgeCheck } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import type { Bill } from "@/lib/data";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };


export function NoticeBoard() {
  const [user] = useAuthState(auth);
  const [upcomingPayments, setUpcomingPayments] = useState<Bill[]>([]);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "bills"),
        where("userId", "==", user.uid),
        where("paid", "==", false),
        orderBy("dueDate", "asc"),
        limit(3)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUpcomingPayments(snapshot.docs.map(doc => doc.data() as Bill));
      });
      return () => unsubscribe();
    }
  }, [user, db]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <span>Notice Board</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingPayments.length > 0 ? (
          upcomingPayments.map((payment, index) => {
            return (
              <Alert key={index}>
                <FileText className="h-4 w-4" />
                <AlertTitle className="flex justify-between">
                  <span>{payment.title}</span>
                  <span className="text-muted-foreground font-normal">
                    Due {formatDistanceToNow(new Date(payment.dueDate), { addSuffix: true })}
                  </span>
                </AlertTitle>
                <AlertDescription>
                  Your payment of <span className="font-semibold">{formatCurrency(payment.amount)}</span> is due soon.
                </AlertDescription>
              </Alert>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-24">
            <BadgeCheck className="h-8 w-8 mb-2 text-green-500" />
            <p>No upcoming payment reminders. You're all caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
