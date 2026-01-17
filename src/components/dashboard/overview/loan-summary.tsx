
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HandCoins, TrendingUp, TrendingDown } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Loan, LoanTransaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function LoanSummary() {
  const [user, loading] = useAuthState();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user && db) {
      const q = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userLoans = snapshot.docs.map((doc) => {
          const data = doc.data();
          const totalLoan = (data.transactions || []).filter((t: LoanTransaction) => t.type === 'loan').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
          const totalRepayment = (data.transactions || []).filter((t: LoanTransaction) => t.type === 'repayment').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
          return {
            id: doc.id,
            ...data,
            totalLoan,
            totalRepayment,
            balance: totalLoan - totalRepayment,
          } as Loan;
        });
        setLoans(userLoans);
        setDataLoading(false);
      });
      return () => unsubscribe();
    } else if (!user) {
      setDataLoading(false);
    }
  }, [user, db]);

  const { totalLoanTaken, totalLoanGiven } = useMemo(() => {
    const taken = loans
      .filter((l) => l.type === 'taken')
      .reduce((sum, l) => sum + l.balance, 0);

    const given = loans
      .filter((l) => l.type === 'given')
      .reduce((sum, l) => sum + l.balance, 0);
    
    return { totalLoanTaken: taken, totalLoanGiven: given };
  }, [loans]);

  if (loading || dataLoading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <HandCoins />
            Loan Summary
        </CardTitle>
        <CardDescription>
          An overview of your outstanding loans.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex items-center gap-4">
            <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Total Loan Taken</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLoanTaken)}</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="bg-green-100 dark:bg-green-900/50 p-3 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
                <p className="text-sm text-muted-foreground">Total Loan Given</p>
                <p className="text-2xl font-bold">{formatCurrency(totalLoanGiven)}</p>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
