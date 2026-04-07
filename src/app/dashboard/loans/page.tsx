"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Loan, Account, Transaction } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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
      
      const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
          setRawAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>)));
      });

      const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
          unsubscribe();
          unsubscribeAccounts();
          unsubscribeTransactions();
      };
    } else {
        setLoading(false);
    }
  }, [user]);

  const accountsWithBalance = useMemo(() => {
    const balances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
        balances[acc.id] = 0;
    });
    
    const accountMap = new Map(rawAccounts.map(acc => [acc.id, acc]));

    transactions.forEach(t => {
        if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if(account?.type !== 'card') {
                balances[t.accountId] += t.amount;
            }
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && balances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if (account?.type === 'card') {
                balances[t.accountId] += t.amount;
            } else {
                balances[t.accountId] -= t.amount;
            }
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && balances[t.fromAccountId] !== undefined) {
                const fromAccount = accountMap.get(t.fromAccountId);
                if (fromAccount?.type === 'card') {
                    balances[t.fromAccountId] += t.amount;
                } else {
                    balances[t.fromAccountId] -= t.amount;
                }
            }
            if (t.toAccountId && balances[t.toAccountId] !== undefined) {
                const toAccount = accountMap.get(t.toAccountId);
                if (toAccount?.type === 'card') {
                    balances[t.toAccountId] -= t.amount;
                } else {
                    balances[t.toAccountId] += t.amount;
                }
            }
        }
    });

    return rawAccounts.map(acc => ({
        ...acc,
        balance: balances[acc.id] ?? 0,
    }));
  }, [rawAccounts, transactions]);

  const creditCards = useMemo(() => accountsWithBalance.filter(acc => acc.type === 'card'), [accountsWithBalance]);
  const totalCreditCardDebt = useMemo(() => creditCards.reduce((sum, card) => sum + card.balance, 0), [creditCards]);


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
                <span className="font-bold text-lg text-red-600">{!loading && formatCurrency(balanceLoanTaken + totalCreditCardDebt)}</span>
            </div>
            <div className="w-full text-xs text-muted-foreground mt-1 space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <span>Loan taken: {formatCurrency(totalLoanTaken)}</span>
                  <span>Repayment: {formatCurrency(totalRepaymentForTaken)}</span>
                </div>
                <div>
                  <span>Credit Card Due: {formatCurrency(totalCreditCardDebt)}</span>
                </div>
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
          <LoanList loanType="taken" creditCards={creditCards} transactions={transactions} />
        </TabsContent>
        <TabsContent value="given" className="mt-6">
          <LoanList loanType="given" transactions={transactions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
