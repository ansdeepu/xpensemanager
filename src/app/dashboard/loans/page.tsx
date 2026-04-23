
"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuthState } from "@/hooks/use-auth-state";
import type { Loan, Account, Transaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
          return {
            id: doc.id,
            ...data,
            transactions,
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

  const primaryAccount = useMemo(() => accountsWithBalance.find(a => a.isPrimary), [accountsWithBalance]);
  const creditCards = useMemo(() => accountsWithBalance.filter(acc => acc.type === 'card'), [accountsWithBalance]);
  const sbiCard = useMemo(() => creditCards.find(c => c.name.toLowerCase().includes('sbi')), [creditCards]);
  
  const otherBanks = useMemo(() => accountsWithBalance.filter(a => 
    !a.isPrimary && (
        a.name.toLowerCase().includes('fed') || 
        a.name.toLowerCase().includes('hdfc') || 
        a.name.toLowerCase().includes('post') || 
        a.name.toLowerCase().includes('money box')
    )
  ), [accountsWithBalance]);

  const primaryEcosystemIds = useMemo(() => {
    return [primaryAccount?.id, 'cash-wallet', 'digital-wallet', sbiCard?.id].filter(Boolean) as string[];
  }, [primaryAccount, sbiCard]);

  const otherBankIds = useMemo(() => otherBanks.map(b => b.id), [otherBanks]);

  const stats = useMemo(() => {
    const interval = startDate && endDate ? { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) } : null;

    let res = {
      taken: { periodLoan: 0, periodRepay: 0, overallBal: 0 },
      givenPrimary: { periodLoan: 0, periodRepay: 0, overallBal: 0 },
      givenOther: { periodLoan: 0, periodRepay: 0, overallBal: 0 },
      totalCreditCardDebt: creditCards.reduce((sum, card) => sum + card.balance, 0)
    };

    const creditCardNames = new Set(creditCards.map(c => c.name.toLowerCase()));
    const actualLoans = allLoans.filter(l => !creditCardNames.has(l.personName.toLowerCase()));

    actualLoans.forEach(loan => {
        const txs = loan.transactions || [];
        
        // Helper to process transactions for a specific set of accounts
        const process = (targetIds: string[]) => {
            const filtered = txs.filter(t => targetIds.includes(t.accountId));
            const totalLoan = filtered.filter(t => t.type === 'loan').reduce((s, t) => s + t.amount, 0);
            const totalRepay = filtered.filter(t => t.type === 'repayment').reduce((s, t) => s + t.amount, 0);
            
            let periodLoan = 0;
            let periodRepay = 0;
            if (interval) {
                const inPeriod = filtered.filter(t => {
                    const d = parseISO(t.date);
                    return isValid(d) && isWithinInterval(d, interval);
                });
                periodLoan = inPeriod.filter(t => t.type === 'loan').reduce((s, t) => s + t.amount, 0);
                periodRepay = inPeriod.filter(t => t.type === 'repayment').reduce((s, t) => s + t.amount, 0);
            }
            
            return { pLoan: periodLoan, pRepay: periodRepay, oBal: totalLoan - totalRepay };
        };

        if (loan.type === 'taken') {
            const p = process(primaryEcosystemIds);
            res.taken.periodLoan += p.pLoan;
            res.taken.periodRepay += p.pRepay;
            res.taken.overallBal += p.oBal;
        } else {
            const pPrimary = process(primaryEcosystemIds);
            res.givenPrimary.periodLoan += pPrimary.pLoan;
            res.givenPrimary.periodRepay += pPrimary.pRepay;
            res.givenPrimary.overallBal += pPrimary.oBal;

            const pOther = process(otherBankIds);
            res.givenOther.periodLoan += pOther.pLoan;
            res.givenOther.periodRepay += pOther.pRepay;
            res.givenOther.overallBal += pOther.oBal;
        }
    });

    return res;
  }, [allLoans, creditCards, startDate, endDate, primaryEcosystemIds, otherBankIds]);

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
        <TabsList className="grid w-full grid-cols-3 h-auto gap-2 bg-transparent p-0">
          <TabsTrigger value="taken" className="flex flex-col h-auto p-3 items-start text-left border rounded-lg data-[state=active]:shadow-md">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-sm">Loan Taken (Primary)</span>
                <span className="font-bold text-base text-red-600">{!loading && formatCurrency(stats.taken.overallBal + stats.totalCreditCardDebt)}</span>
            </div>
            <div className="w-full text-[10px] text-muted-foreground mt-2 space-y-1 leading-tight">
                <div className="flex justify-between">
                  <span>Loan Taken (Period):</span> <span>{formatCurrency(stats.taken.periodLoan)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repayment (Period):</span> <span>{formatCurrency(stats.taken.periodRepay)}</span>
                </div>
                <div className="pt-1 mt-1 border-t flex justify-between font-medium">
                  <span>Card Due (Total):</span> <span>{formatCurrency(stats.totalCreditCardDebt)}</span>
                </div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="given" className="flex flex-col h-auto p-3 items-start text-left border rounded-lg data-[state=active]:shadow-md">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-sm">Loan Given (Primary)</span>
                <span className="font-bold text-base text-green-600">{!loading && formatCurrency(stats.givenPrimary.overallBal)}</span>
            </div>
             <div className="w-full text-[10px] text-muted-foreground mt-2 space-y-1 leading-tight">
                <div className="flex justify-between">
                  <span>Loan Given (Period):</span> <span>{formatCurrency(stats.givenPrimary.periodLoan)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repayment (Period):</span> <span>{formatCurrency(stats.givenPrimary.periodRepay)}</span>
                </div>
            </div>
          </TabsTrigger>

          <TabsTrigger value="other" className="flex flex-col h-auto p-3 items-start text-left border rounded-lg data-[state=active]:shadow-md">
            <div className="w-full flex justify-between items-center">
                <span className="font-semibold text-sm">Loan Given (Other Banks)</span>
                <span className="font-bold text-base text-blue-600">{!loading && formatCurrency(stats.givenOther.overallBal)}</span>
            </div>
             <div className="w-full text-[10px] text-muted-foreground mt-2 space-y-1 leading-tight">
                <div className="flex justify-between">
                  <span>Loan Given (Period):</span> <span>{formatCurrency(stats.givenOther.periodLoan)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Repayment (Period):</span> <span>{formatCurrency(stats.givenOther.periodRepay)}</span>
                </div>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="taken" className="mt-6">
          <LoanList 
            loanType="taken" 
            loans={allLoans.filter(l => l.type === 'taken' && l.transactions.some(t => primaryEcosystemIds.includes(t.accountId)))} 
            creditCards={creditCards} 
            transactions={allTransactions} 
            startDate={startDate} 
            endDate={endDate}
            allowedAccountIds={primaryEcosystemIds}
          />
        </TabsContent>

        <TabsContent value="given" className="mt-6">
          <LoanList 
            loanType="given" 
            loans={allLoans.filter(l => l.type === 'given' && l.transactions.some(t => primaryEcosystemIds.includes(t.accountId)))}
            transactions={allTransactions}
            startDate={startDate} 
            endDate={endDate}
            allowedAccountIds={primaryEcosystemIds}
          />
        </TabsContent>

        <TabsContent value="other" className="mt-6">
          <LoanList 
            loanType="given" 
            loans={allLoans.filter(l => l.type === 'given' && l.transactions.some(t => otherBankIds.includes(t.accountId)))}
            transactions={allTransactions}
            startDate={startDate} 
            endDate={endDate}
            allowedAccountIds={otherBankIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
