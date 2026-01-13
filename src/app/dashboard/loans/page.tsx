
"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Loan } from "@/lib/data";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export default function LoansPage() {
  const [user] = useAuthState();
  const [loans, setLoans] = useState<Loan[]>([]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userLoans = snapshot.docs.map((doc) => {
          const data = doc.data();
          const totalLoan = (data.transactions || []).filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
          const totalRepayment = (data.transactions || []).filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
          return {
            id: doc.id,
            ...data,
            balance: totalLoan - totalRepayment,
          } as Loan;
        });
        setLoans(userLoans);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const totalLoanTaken = loans
    .filter((l) => l.type === 'taken')
    .reduce((sum, l) => sum + l.balance, 0);

  const totalLoanGiven = loans
    .filter((l) => l.type === 'given')
    .reduce((sum, l) => sum + l.balance, 0);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="taken" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="taken">
            Loan Taken <span className="ml-2 font-bold text-red-600">{formatCurrency(totalLoanTaken)}</span>
          </TabsTrigger>
          <TabsTrigger value="given">
            Loan Given <span className="ml-2 font-bold text-green-600">{formatCurrency(totalLoanGiven)}</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="taken" className="mt-6">
          <LoanList loanType="taken" />
        </TabsContent>
        <TabsContent value="given" className="mt-6">
          <LoanList loanType="given" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

    