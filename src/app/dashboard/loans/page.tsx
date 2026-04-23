
"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Loan, Account, Transaction } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startOfMonth, endOfMonth, format, isWithinInterval, parseISO, isValid, startOfDay, endOfDay } from "date-fns";

const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(val);
};

export default function LoansPage() {
  const [user] = useAuthState();
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);

  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));

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
        setAllLoans(userLoans);
        setLoading(false);
      });
      
      const accountsQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
          setRawAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>)));
      });

      const transactionsQuery = query(collection(db, 'transactions'), where('userId', '==', user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          setAllTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
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

    allTransactions.forEach(t => {
        if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if(account?.type === 'card') {
                balances[t.accountId] -= t.amount; // Income to card decreases debt
            } else {
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
  }, [rawAccounts, allTransactions]);

  const creditCards = useMemo(() => accountsWithBalance.filter(acc => acc.type === 'card'), [accountsWithBalance]);
  
  const {
    totalLoanTakenForPeriod,
    totalRepaymentForTakenForPeriod,
    balanceLoanTaken,
    totalLoanGivenForPeriod,
    totalRepaymentForGivenForPeriod,
    balanceLoanGiven,
    totalCreditCardDebt
  } = useMemo(() => {
    const interval = startDate && endDate ? { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) } : null;

    let totalLoanTakenForPeriod = 0;
    let totalRepaymentForTakenForPeriod = 0;
    let totalLoanGivenForPeriod = 0;
    let totalRepaymentForGivenForPeriod = 0;

    // Prevent double counting: filter out loan entries that actually represent bank accounts (credit cards)
    const creditCardNames = new Set(creditCards.map(c => c.name.toLowerCase()));
    const actualLoans = allLoans.filter(l => !creditCardNames.has(l.personName.toLowerCase()));

    if (interval) {
        actualLoans.forEach(loan => {
            const filteredTransactions = (loan.transactions || []).filter(t => {
                const transactionDate = parseISO(t.date);
                return isValid(transactionDate) && isWithinInterval(transactionDate, interval);
            });
            
            const periodTotalLoan = filteredTransactions.filter(t => t.type === 'loan').reduce((sum, t) => sum + t.amount, 0);
            const periodTotalRepayment = filteredTransactions.filter(t => t.type === 'repayment').reduce((sum, t) => sum + t.amount, 0);

            if (loan.type === 'taken') {
                totalLoanTakenForPeriod += periodTotalLoan;
                totalRepaymentForTakenForPeriod += periodTotalRepayment;
            } else { // given
                totalLoanGivenForPeriod += periodTotalLoan;
                totalRepaymentForGivenForPeriod += periodTotalRepayment;
            }
        });
    }

    const overallBalanceLoanTaken = actualLoans.filter((l) => l.type === 'taken').reduce((sum, l) => sum + l.balance, 0);
    const overallBalanceLoanGiven = actualLoans.filter((l) => l.type === 'given').reduce((sum, l) => sum + l.balance, 0);
    const totalCreditCardDebt = creditCards.reduce((sum, card) => sum + card.balance, 0);

    return {
      totalLoanTakenForPeriod,
      totalRepaymentForTakenForPeriod,
      balanceLoanTaken: overallBalanceLoanTaken,
      totalLoanGivenForPeriod,
      totalRepaymentForGivenForPeriod,
      balanceLoanGiven: overallBalanceLoanGiven,
      totalCreditCardDebt
    };
  }, [allLoans, creditCards, startDate, endDate]);


  return (
    <div className="space-y-6 max-w-5xl mx-auto">
       <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter by Date</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
            </div>
          </CardContent>
        </Card>
      <Tabs defaultValue="taken" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-auto">
          <TabsTrigger value="taken" className="flex flex-col h-auto p-2 items-start text-left">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-base">Loan Taken</span>
                <span className="font-bold text-lg text-red-600">{!loading && formatCurrency(balanceLoanTaken + totalCreditCardDebt)}</span>
            </div>
            <div className="w-full text-xs text-muted-foreground mt-1 space-y-1">
                <div className="grid grid-cols-2 gap-2">
                  <span>Loan taken (Period): {formatCurrency(totalLoanTakenForPeriod)}</span>
                  <span>Repayment (Period): {formatCurrency(totalRepaymentForTakenForPeriod)}</span>
                </div>
                <div>
                  <span>Credit Card Due (Total): {formatCurrency(totalCreditCardDebt)}</span>
                </div>
            </div>
          </TabsTrigger>
          <TabsTrigger value="given" className="flex flex-col h-auto p-2 items-start text-left">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-base">Loan Given</span>
                <span className="font-bold text-lg text-green-600">{!loading && formatCurrency(balanceLoanGiven)}</span>
            </div>
             <div className="w-full text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-2">
                <span>Loan Given (Period): {formatCurrency(totalLoanGivenForPeriod)}</span>
                <span>Repayment (Period): {formatCurrency(totalRepaymentForGivenForPeriod)}</span>
            </div>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="taken" className="mt-6">
          <LoanList 
            loanType="taken" 
            loans={allLoans.filter(l => l.type === 'taken')} 
            creditCards={creditCards} 
            transactions={allTransactions} 
            startDate={startDate} 
            endDate={endDate}
          />
        </TabsContent>
        <TabsContent value="given" className="mt-6">
          <LoanList 
            loanType="given" 
            loans={allLoans.filter(l => l.type === 'given')}
            transactions={allTransactions}
            startDate={startDate} 
            endDate={endDate}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
