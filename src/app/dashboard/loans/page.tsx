
"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userLoans = snapshot.docs.map((doc) => {
          const data = doc.data();
          const transactions = data.transactions || [];
          const totalLoan = transactions.filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
          const totalRepayment = transactions.filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
          return {
            id: doc.id,
            ...data,
            transactions,
            totalLoan,
            totalRepayment,
            balance: totalLoan - totalRepayment,
          } as Loan;
        });
        setLoans(userLoans);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
        setLoading(false);
    }
  }, [user]);

  const {
    totalLoanTaken,
    totalRepaymentForTaken,
    balanceLoanTaken,
    totalLoanGiven,
    totalRepaymentForGiven,
    balanceLoanGiven
  } = useMemo(() => {
    if (loading) return { totalLoanTaken: 0, totalRepaymentForTaken: 0, balanceLoanTaken: 0, totalLoanGiven: 0, totalRepaymentForGiven: 0, balanceLoanGiven: 0 };
    
    const loansTaken = loans.filter((l) => l.type === 'taken');
    const totalLoanTaken = loansTaken.reduce((sum, l) => sum + l.totalLoan, 0);
    const totalRepaymentForTaken = loansTaken.reduce((sum, l) => sum + l.totalRepayment, 0);

    const loansGiven = loans.filter((l) => l.type === 'given');
    const totalLoanGiven = loansGiven.reduce((sum, l) => sum + l.totalLoan, 0);
    const totalRepaymentForGiven = loansGiven.reduce((sum, l) => sum + l.totalRepayment, 0);

    return {
      totalLoanTaken,
      totalRepaymentForTaken,
      balanceLoanTaken: totalLoanTaken - totalRepaymentForTaken,
      totalLoanGiven,
      totalRepaymentForGiven,
      balanceLoanGiven: totalLoanGiven - totalRepaymentForGiven
    };
  }, [loans, loading]);


  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Tabs defaultValue="taken" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="taken" className="flex flex-col h-auto p-2 items-start text-left">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-base">Loan Taken</span>
                <span className="font-bold text-lg text-red-600">{!loading && formatCurrency(balanceLoanTaken)}</span>
            </div>
            <div className="w-full text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                <span>Loan taken: {formatCurrency(totalLoanTaken)}</span>
                <span>Repayment: {formatCurrency(totalRepaymentForTaken)}</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="given" className="flex flex-col h-auto p-2 items-start text-left">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-base">Loan Given</span>
                <span className="font-bold text-lg text-green-600">{!loading && formatCurrency(balanceLoanGiven)}</span>
            </div>
             <div className="w-full text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                <span>Loan Given: {formatCurrency(totalLoanGiven)}</span>
                <span>Repayment: {formatCurrency(totalRepaymentForGiven)}</span>
            </div>
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
