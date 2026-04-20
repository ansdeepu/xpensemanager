
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp, Landmark } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, isValid, isBefore, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter as DialogFooterComponent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReportDate } from "@/context/report-date-context";
import { FinancialAdvice } from "./financial-advice";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(val);
};

const postBankCategoryNames = [
  'Diesel Collection', 'Staff Club Accounts', 'Ente Keralam Accounts', 'Seminar Accounts',
  'Jayaram Treatment', 'SLR Retirement - Jan 2026', 'Bank Charges', 'Deepa Car Accounts'
];

type CategoryBreakdown = {
  [key: string]: { total: number; budget: number; subcategories: { [key: string]: number } } 
};

type ReportData = {
  totalIncome: number;
  totalExpense: number; 
  incomeByCategory: CategoryBreakdown;
  expenseByCategory: CategoryBreakdown; 
  regularExpenseByCategory: CategoryBreakdown;
  occasionalExpenseByCategory: CategoryBreakdown;
  totalRegularExpense: number;
  totalOccasionalExpense: number;
  totalIncomeBudget: number;
  totalExpenseBudget: number;
  totalRegularBudget: number;
  totalOccasionalBudget: number;
};

type AggregatedEntry = {
    name: string;
    amount: number;
};

export function ReportView({ 
  transactions, 
  categories, 
  accounts, 
  loans, 
  isOverallSummary, 
  accountId, 
  isPrimaryReport 
 }: { 
  transactions: Transaction[], 
  categories: Category[], 
  accounts: Account[], 
  loans: Loan[], 
  isOverallSummary: boolean, 
  accountId?: string, 
  isPrimaryReport?: boolean 
 }) {
  const { currentDate } = useReportDate();
  
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const currentMonthName = useMemo(() => format(currentDate, "MMM"), [currentDate]);

  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);
  const creditCardIds = useMemo(() => new Set(accounts.filter(a => a.type === 'card').map(a => a.id)), [accounts]);
  const sbiCardId = useMemo(() => accounts.find(a => a.type === 'card' && a.name.toLowerCase().includes('sbi'))?.id, [accounts]);

  // --- PASSBOOK SPECIFIC LOGIC (Individual Bank Tabs) ---
  if (!isOverallSummary && !isPrimaryReport && accountId) {
    const accountName = accounts.find(a => a.id === accountId)?.name || 'Account';
    const isPostBank = accountName.toLowerCase().includes('post bank');
    
    // Calculate ALL-TIME reconciliation
    let allTimeInflow = 0;
    let allTimeOutflow = 0;
    const allAccountIncomeDetails: Record<string, number> = {};
    const allAccountExpenseDetails: Record<string, number> = {};
    const allAccountTransferDetails: Transaction[] = [];

    transactions.forEach(t => {
        if (t.accountId === accountId) {
            if (t.type === 'income') {
                allTimeInflow += t.amount;
                allAccountIncomeDetails[t.category || 'Other'] = (allAccountIncomeDetails[t.category || 'Other'] || 0) + t.amount;
            }
            if (t.type === 'expense') {
                allTimeOutflow += t.amount;
                allAccountExpenseDetails[t.category || 'Other'] = (allAccountExpenseDetails[t.category || 'Other'] || 0) + t.amount;
            }
        }
        if (t.type === 'transfer') {
            if (t.fromAccountId === accountId) {
                allTimeOutflow += t.amount;
                allAccountTransferDetails.push(t);
            }
            if (t.toAccountId === accountId) {
                allTimeInflow += t.amount;
                allAccountTransferDetails.push(t);
            }
        }
    });

    const closingBalance = allTimeInflow - allTimeOutflow;

    // Monthly Reconciliation
    let prevBal = 0;
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isValid(d) || !isBefore(d, monthStart)) return;
      if (t.accountId === accountId) {
        if (t.type === 'income') prevBal += t.amount;
        else if (t.type === 'expense') prevBal -= t.amount;
      }
      if (t.type === 'transfer') {
        if (t.fromAccountId === accountId) prevBal -= t.amount;
        if (t.toAccountId === accountId) prevBal += t.amount;
      }
    });

    const currentInflow = transactions.reduce((sum, t) => {
        const d = new Date(t.date);
        if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return sum;
        return (t.accountId === accountId && t.type === 'income') || (t.toAccountId === accountId && t.type === 'transfer') ? sum + t.amount : sum;
    }, 0);
    const currentOutflow = transactions.reduce((sum, t) => {
        const d = new Date(t.date);
        if (!isWithinInterval(d, { start: monthStart, end: monthEnd })) return sum;
        return (t.accountId === accountId && t.type === 'expense') || (t.fromAccountId === accountId && t.type === 'transfer') ? sum + t.amount : sum;
    }, 0);
    const monthClosingBalance = prevBal + currentInflow - currentOutflow;

    const allAccountLoanDetails = loans.map(l => {
        const isMatchByName = l.personName.toLowerCase() === accountName.toLowerCase();
        const accountSpecificTransactions = (l.transactions || []).filter(tx => tx.accountId === accountId || isMatchByName);
        if (accountSpecificTransactions.length === 0) return null;
        
        const totalGiven = accountSpecificTransactions.filter(tx => tx.type === 'loan').reduce((sum, tx) => sum + tx.amount, 0);
        const totalRepayment = accountSpecificTransactions.filter(tx => tx.type === 'repayment').reduce((sum, tx) => sum + tx.amount, 0);
        
        return {
            id: l.id,
            personName: isMatchByName ? "SBI Bank" : l.personName,
            totalGiven,
            totalRepayment,
            balance: totalGiven - totalRepayment,
            transactions: accountSpecificTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
    }).filter(Boolean);

    const postBankAccordionData = isPostBank ? postBankCategoryNames.map(cat => {
        const filteredTxs = transactions.filter(t => 
            (t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId) && 
            (t.subcategory === cat || t.category === cat || (t.description && t.description.toLowerCase().includes(cat.toLowerCase())))
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = 0, creditTotal = 0, debitTotal = 0;
        const txsWithDetails = filteredTxs.map(t => {
            let credit = 0, debit = 0, effect = 0;
            if (t.type === 'income' && t.accountId === accountId) { credit = t.amount; effect = t.amount; }
            else if (t.type === 'expense' && t.accountId === accountId) { debit = t.amount; effect = -t.amount; }
            else if (t.type === 'transfer') {
                if (t.toAccountId === accountId) { credit = t.amount; effect = t.amount; }
                if (t.fromAccountId === accountId) { debit = t.amount; effect = -t.amount; }
            }
            creditTotal += credit; debitTotal += debit; runningBalance += effect;
            return { ...t, credit: credit || null, debit: debit || null, balance: runningBalance };
        });
        return { name: cat, totalCredit: creditTotal, totalDebit: debitTotal, balance: creditTotal - debitTotal, transactions: txsWithDetails.reverse() };
    }) : [];

    return (
      <div className="space-y-6">
        <Card className="bg-muted/10 border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><BookText className="h-5 w-5" />{accountName} ALL-TIME ACCOUNT SUMMARY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-green-600">Total All-Time Inflow</p><p className="text-xl font-bold text-green-600">{formatCurrency(allTimeInflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-red-600">Total All-Time Outflow</p><p className="text-xl font-bold text-red-600">-{formatCurrency(allTimeOutflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold">Current Account Balance</p><p className={cn("text-xl font-bold", closingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(closingBalance)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Landmark className="h-5 w-5" />{accountName} MONTHLY STATEMENT SUMMARY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase">Previous Balance</p><p className="text-xl font-bold">{formatCurrency(prevBal)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-green-600">Monthly Inflow</p><p className="text-xl font-bold text-green-600">+{formatCurrency(currentInflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-red-600">Monthly Outflow</p><p className="text-xl font-bold text-red-600">-{formatCurrency(currentOutflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold">Closing Balance</p><p className={cn("text-xl font-bold", monthClosingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(monthClosingBalance)}</p></div>
            </div>
          </CardContent>
        </Card>

        {isPostBank ? (
            <>
                <Card>
                    <CardHeader><CardTitle>Post Bank Category Breakdown (All Time)</CardTitle><CardDescription>Status of sub-funds within the account.</CardDescription></CardHeader>
                    <CardContent>
                        <Accordion type="single" collapsible className="w-full">
                            {postBankAccordionData.map((cat, idx) => (
                                <AccordionItem key={idx} value={`post-${idx}`}>
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex justify-between w-full pr-4"><span>{cat.name}</span><span className={cn("font-bold", cat.balance >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(cat.balance)}</span></div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="p-4 bg-muted/30 rounded-lg">
                                            <div className="flex gap-4 mb-4 text-xs font-semibold">
                                                <span>Total Credit: <span className="text-green-600">{formatCurrency(cat.totalCredit)}</span></span>
                                                <span>Total Debit: <span className="text-red-600">{formatCurrency(cat.totalDebit)}</span></span>
                                            </div>
                                            <Table className="text-xs">
                                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {cat.transactions.map((tx, i) => (
                                                        <TableRow key={i}>
                                                            <TableCell>{format(new Date(tx.date), 'dd/MM/yy')}</TableCell>
                                                            <TableCell>{tx.description}</TableCell>
                                                            <TableCell className="text-right text-green-600">{tx.credit ? formatCurrency(tx.credit) : ''}</TableCell>
                                                            <TableCell className="text-right text-red-600">{tx.debit ? formatCurrency(tx.debit) : ''}</TableCell>
                                                            <TableCell className="text-right font-mono">{formatCurrency(tx.balance)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </CardContent>
                </Card>
                <div className="grid gap-6 lg:grid-cols-2 items-start">
                    <Card>
                        <CardHeader><CardTitle>Loan Details (All Time)</CardTitle></CardHeader>
                        <CardContent>
                            <Accordion type="single" collapsible className="w-full">
                                {allAccountLoanDetails.map(loan => (
                                    <AccordionItem key={loan!.id} value={loan!.id}>
                                        <AccordionTrigger className="py-2 hover:no-underline">
                                            <div className="flex justify-between w-full pr-4 text-sm font-medium"><span>{loan!.personName}</span><Badge variant="outline">{formatCurrency(loan!.balance)}</Badge></div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <Table className="text-[10px]">
                                                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Loan</TableHead><TableHead className="text-right">Repayment</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {loan!.transactions.map(tx => (
                                                        <TableRow key={tx.id}>
                                                            <TableCell>{format(parseISO(tx.date), 'dd/MM/yy')}</TableCell>
                                                            <TableCell className="text-right text-red-600">{tx.type === 'loan' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                            <TableCell className="text-right text-green-600">{tx.type === 'repayment' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                                {allAccountLoanDetails.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs italic">No loans recorded.</div>}
                            </Accordion>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Transfer Details (All Time)</CardTitle></CardHeader>
                        <CardContent><ScrollArea className="h-[300px]"><Table><TableBody>{allAccountTransferDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
                                const isOut = t.fromAccountId === accountId;
                                const otherName = accounts.find(a => a.id === (isOut ? t.toAccountId : t.fromAccountId))?.name || 'Other';
                                return <TableRow key={t.id}><TableCell className="text-xs">{format(new Date(t.date), 'dd/MM/yy')}</TableCell><TableCell className="text-xs">{isOut ? `➔ ${otherName}` : `← ${otherName}`}</TableCell><TableCell className={cn("text-right text-xs", isOut ? "text-red-600" : "text-green-600")}>{formatCurrency(t.amount)}</TableCell></TableRow>
                            })}{allAccountTransferDetails.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No transfers recorded.</TableCell></TableRow>}</TableBody></Table></ScrollArea></CardContent>
                    </Card>
                </div>
            </>
        ) : (
            <div className="grid gap-6 lg:grid-cols-2 items-start">
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Income Details (All Time)</CardTitle></CardHeader>
                        <CardContent><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{Object.entries(allAccountIncomeDetails).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                            <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(amount)}</TableCell></TableRow>
                        ))}{Object.keys(allAccountIncomeDetails).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-xs italic">No income records.</TableCell></TableRow>}</TableBody></Table></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Loan Details (All Time)</CardTitle></CardHeader>
                        <CardContent><Accordion type="single" collapsible className="w-full">{allAccountLoanDetails.map(loan => (
                            <AccordionItem key={loan!.id} value={loan!.id}><AccordionTrigger className="py-2 hover:no-underline"><div className="flex justify-between w-full pr-4 text-sm font-medium"><span>{loan!.personName}</span><Badge variant="outline">{formatCurrency(loan!.balance)}</Badge></div></AccordionTrigger><AccordionContent><Table className="text-[10px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Loan</TableHead><TableHead className="text-right">Repayment</TableHead></TableRow></TableHeader><TableBody>{loan!.transactions.map(tx => (<TableRow key={tx.id}><TableCell>{format(parseISO(tx.date), 'dd/MM/yy')}</TableCell><TableCell className="text-right text-red-600">{tx.type === 'loan' ? formatCurrency(tx.amount) : ''}</TableCell><TableCell className="text-right text-green-600">{tx.type === 'repayment' ? formatCurrency(tx.amount) : ''}</TableCell></TableRow>))}</TableBody></Table></AccordionContent></AccordionItem>
                        ))}{allAccountLoanDetails.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs italic">No loans found.</div>}</Accordion></CardContent>
                    </Card>
                </div>
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Expense Details (All Time)</CardTitle></CardHeader>
                        <CardContent><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{Object.entries(allAccountExpenseDetails).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                            <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(amount)}</TableCell></TableRow>
                        ))}{Object.keys(allAccountExpenseDetails).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-xs italic">No expense records.</TableCell></TableRow>}</TableBody></Table></CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Transfer Details (All Time)</CardTitle></CardHeader>
                        <CardContent><ScrollArea className="h-[300px]"><Table><TableBody>{allAccountTransferDetails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => {
                                const isOut = t.fromAccountId === accountId;
                                const otherName = accounts.find(a => a.id === (isOut ? t.toAccountId : t.fromAccountId))?.name || 'Other';
                                return <TableRow key={t.id}><TableCell className="text-xs">{format(new Date(t.date), 'dd/MM/yy')}</TableCell><TableCell className="text-xs">{isOut ? `➔ ${otherName}` : `← ${otherName}`}</TableCell><TableCell className={cn("text-right text-xs", isOut ? "text-red-600" : "text-green-600")}>{formatCurrency(t.amount)}</TableCell></TableRow>
                            })}{allAccountTransferDetails.length === 0 && <TableRow><TableCell colSpan={3} className="text-center py-10 text-muted-foreground">No transfers recorded.</TableCell></TableRow>}</TableBody></Table></ScrollArea></CardContent>
                    </Card>
                </div>
            </div>
        )}
      </div>
    );
  }

  // --- MONTHLY SUMMARY LOGIC (PRIMARY & OVERALL) ---
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
        const d = new Date(t.date);
        return isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
  }, [transactions, monthStart, monthEnd]);

  const { monthlyLoanReport, monthlyTransferSummary } = useMemo(() => {
    const report = {
        totalLoanTaken: 0, totalLoanGiven: 0, totalRepaymentMade: 0, totalRepaymentReceived: 0,
        totalSBILoan: 0, totalSBIRepayment: 0, totalSBICashback: 0, totalSBICharges: 0,
        loanTakenMap: {} as Record<string, number>, loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>, repaymentReceivedMap: {} as Record<string, number>,
        sbiLoanTransactions: [] as AggregatedEntry[], sbiRepaymentTransactions: [] as AggregatedEntry[],
        sbiCashbackTransactions: [] as AggregatedEntry[], sbiChargesTransactions: [] as AggregatedEntry[],
    };

    let totalTransferOut = 0;
    const transferOutDetails: AggregatedEntry[] = [];
    const isInEcosystem = (accId?: string) => accId === primaryAccount?.id || accId === 'cash-wallet' || accId === 'digital-wallet' || (accId && creditCardIds.has(accId));

    loans.forEach(loan => {
        if (loan.personName.toLowerCase().includes('sbi')) return;
        (loan.transactions || []).forEach(tx => {
            const d = new Date(tx.date);
            if (isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
                let include = isOverallSummary || (isPrimaryReport && isInEcosystem(tx.accountId));
                if (include) {
                    if (loan.type === 'taken') {
                        if (tx.type === 'loan') { report.totalLoanTaken += tx.amount; report.loanTakenMap[loan.personName] = (report.loanTakenMap[loan.personName] || 0) + tx.amount; }
                        else { report.totalRepaymentMade += tx.amount; report.repaymentMadeMap[loan.personName] = (report.repaymentMadeMap[loan.personName] || 0) + tx.amount; }
                    } else {
                        if (tx.type === 'loan') { report.totalLoanGiven += tx.amount; report.loanGivenMap[loan.personName] = (report.loanGivenMap[loan.personName] || 0) + tx.amount; }
                        else { report.totalRepaymentReceived += tx.amount; report.repaymentReceivedMap[loan.personName] = (report.repaymentReceivedMap[loan.personName] || 0) + tx.amount; }
                    }
                }
            }
        });
    });

    monthlyTransactions.forEach(t => {
        const isSBIAccount = t.accountId === sbiCardId || t.fromAccountId === sbiCardId || t.toAccountId === sbiCardId;
        if (isSBIAccount && (isOverallSummary || isPrimaryReport)) {
            const isSBICashback = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId === 'cashback-source';
            const isSBIRepayment = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId !== 'cashback-source' && !creditCardIds.has(t.fromAccountId!);
            const isSBICharge = t.type === 'expense' && t.accountId === sbiCardId && (t.category?.toLowerCase().includes('charge') || t.category?.toLowerCase().includes('bank charge'));
            const isSBILoanSpending = (t.type === 'expense' && t.accountId === sbiCardId && !isSBICharge) || (t.type === 'transfer' && t.fromAccountId === sbiCardId);

            if (isSBILoanSpending) { report.totalSBILoan += t.amount; report.sbiLoanTransactions.push({ name: t.description || 'Card Usage', amount: t.amount }); }
            else if (isSBIRepayment) { report.totalSBIRepayment += t.amount; report.sbiRepaymentTransactions.push({ name: t.description || 'Repayment', amount: t.amount }); }
            else if (isSBICashback) { report.totalSBICashback += t.amount; report.sbiCashbackTransactions.push({ name: t.description || 'Cashback', amount: t.amount }); }
            else if (isSBICharge) { report.totalSBICharges += t.amount; report.sbiChargesTransactions.push({ name: t.description || 'Bank Charge', amount: t.amount }); }
        }
        if (t.type === 'transfer' && isInEcosystem(t.fromAccountId) && !isInEcosystem(t.toAccountId) && !t.loanTransactionId) {
            const target = accounts.find(a => a.id === t.toAccountId);
            if (target) { totalTransferOut += t.amount; transferOutDetails.push({ name: target.name, amount: t.amount }); }
        }
    });

    const sortEntries = (map: Record<string, number>) => Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    return {
        monthlyLoanReport: { ...report, loanTakenTransactions: sortEntries(report.loanTakenMap), loanGivenTransactions: sortEntries(report.loanGivenMap), repaymentMadeTransactions: sortEntries(report.repaymentMadeMap), repaymentReceivedTransactions: sortEntries(report.repaymentReceivedMap) },
        monthlyTransferSummary: { total: totalTransferOut, details: transferOutDetails }
    };
  }, [loans, monthlyTransactions, isOverallSummary, isPrimaryReport, sbiCardId, creditCardIds, primaryAccount, monthStart, monthEnd, accounts]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = { totalIncome: 0, totalExpense: 0, incomeByCategory: {}, expenseByCategory: {}, regularExpenseByCategory: {}, occasionalExpenseByCategory: {}, totalRegularExpense: 0, totalOccasionalExpense: 0, totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0 };
    const bankExpenseNames = new Set(categories.filter(c => c.type === 'bank-expense').map(c => c.name));
    
    monthlyTransactions.forEach(t => {
        let include = isOverallSummary || (isPrimaryReport && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || (t.accountId && creditCardIds.has(t.accountId))));
        if (!include) return;
        const cat = t.category || "Uncategorized";
        const sub = t.subcategory || "Unspecified";
        if (t.type === 'income') {
            data.totalIncome += t.amount;
            if (!data.incomeByCategory[cat]) data.incomeByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
            data.incomeByCategory[cat].total += t.amount;
            data.incomeByCategory[cat].subcategories[sub] = (data.incomeByCategory[cat].subcategories[sub] || 0) + t.amount;
        } else if (t.type === 'expense' && !bankExpenseNames.has(cat)) {
            data.totalExpense += t.amount;
            if (!data.expenseByCategory[cat]) data.expenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
            data.expenseByCategory[cat].total += t.amount;
            data.expenseByCategory[cat].subcategories[sub] = (data.expenseByCategory[cat].subcategories[sub] || 0) + t.amount;
            if (t.frequency === 'occasional') {
                data.totalOccasionalExpense += t.amount;
                if (!data.occasionalExpenseByCategory[cat]) data.occasionalExpenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                data.occasionalExpenseByCategory[cat].total += t.amount;
                data.occasionalExpenseByCategory[cat].subcategories[sub] = (data.occasionalExpenseByCategory[cat].subcategories[sub] || 0) + t.amount;
            } else {
                data.totalRegularExpense += t.amount;
                if (!data.regularExpenseByCategory[cat]) data.regularExpenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                data.regularExpenseByCategory[cat].total += t.amount;
                data.regularExpenseByCategory[cat].subcategories[sub] = (data.regularExpenseByCategory[cat].subcategories[sub] || 0) + t.amount;
            }
        }
    });

    categories.forEach(cat => {
        const regB = cat.subcategories.filter(s => s.frequency === 'monthly').reduce((s, b) => s + (b.amount || 0), 0);
        const occB = cat.subcategories.filter(s => s.frequency === 'occasional' && s.selectedMonths?.includes(currentMonthName)).reduce((s, b) => s + (b.amount || 0), 0);
        const totB = regB + occB;
        if (cat.type === 'expense') {
            if (totB > 0) {
                if (!data.regularExpenseByCategory[cat.name]) data.regularExpenseByCategory[cat.name] = { total: 0, budget: 0, subcategories: {} };
                data.regularExpenseByCategory[cat.name].budget = totB;
                data.totalRegularBudget += totB;
            }
            data.totalExpenseBudget += totB;
        } else if (cat.type === 'income') {
            if (data.incomeByCategory[cat.name]) data.incomeByCategory[cat.name].budget = totB;
            data.totalIncomeBudget += totB;
        }
    });
    return data;
  }, [monthlyTransactions, isOverallSummary, isPrimaryReport, accountId, creditCardIds, categories, currentMonthName]);

  const grandTotalInflow = monthlyReport.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan + monthlyLoanReport.totalSBICashback;
  const sbiNetAdjustmentOutflow = monthlyLoanReport.totalSBIRepayment + monthlyLoanReport.totalSBICharges - monthlyLoanReport.totalSBICashback;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + Math.max(0, sbiNetAdjustmentOutflow) + monthlyTransferSummary.total;
  const netBalance = grandTotalInflow - grandTotalOutflow;

  return (
    <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
            <Collapsible open={isInflowOpen} onOpenChange={setIsInflowOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Inflow</CardTitle><div className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-muted-foreground" />{isInflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Income:</span><span>{formatCurrency(monthlyReport.totalIncome)}</span></div><div className="flex justify-between text-xs"><span>Loan Taken:</span><span>{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span></div><div className="flex justify-between text-xs"><span>Repay. Received:</span><span>{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span></div><div className="flex justify-between text-xs"><span>SBI Usage:</span><span>{formatCurrency(monthlyLoanReport.totalSBILoan)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
            <Collapsible open={isOutflowOpen} onOpenChange={setIsOutflowOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Outflow</CardTitle><div className="flex items-center gap-1"><TrendingDown className="h-4 w-4 text-muted-foreground" />{isOutflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Expenses:</span><span>{formatCurrency(monthlyReport.totalExpense)}</span></div><div className="flex justify-between text-xs"><span>Loan Given:</span><span>{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div><div className="flex justify-between text-xs"><span>Repay. Made:</span><span>{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div><div className="flex justify-between text-xs"><span>SBI CC Repay & Adj:</span><span>{formatCurrency(sbiNetAdjustmentOutflow)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
            <Collapsible open={isNetOpen} onOpenChange={setIsNetOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Net Balance</CardTitle><div className="flex items-center gap-1"><IndianRupee className="h-4 w-4 text-muted-foreground" />{isNetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className={cn("text-2xl font-bold", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>{formatCurrency(netBalance)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Inflow:</span><span className="text-green-600">{formatCurrency(grandTotalInflow)}</span></div><div className="flex justify-between text-xs"><span>Outflow:</span><span className="text-red-600">{formatCurrency(grandTotalOutflow)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
        </div>

        <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k,v]) => [k, v.total]))} />

        <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* LEFT COLUMN: INFLOWS */}
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Income Summary</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.incomeByCategory).map(([cat, { total }]) => (
                                    <TableRow key={cat}><TableCell className="font-medium">{cat}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(total)}</TableCell></TableRow>
                                ))}
                                {monthlyLoanReport.totalLoanTaken > 0 && (<TableRow className="font-medium text-green-600"><TableCell>Total Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalRepaymentReceived > 0 && (<TableRow className="font-medium text-green-600"><TableCell>Repayment of Loan Given</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalSBILoan > 0 && (<TableRow className="font-medium text-green-600"><TableCell>SBI Credit Card Usage</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalSBICashback > 0 && (<TableRow className="font-medium text-green-600"><TableCell>SBI Credit Card Cashback</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Inflow</TableHead><TableHead className="text-right font-mono text-green-600">{formatCurrency(grandTotalInflow)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                {/* DETAILED INCOME SECTION */}
                <Card>
                    <CardHeader><CardTitle>Detailed Income Breakdown</CardTitle><CardDescription>Itemized sources for each income category.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {Object.entries(monthlyReport.incomeByCategory).map(([catName, data]) => (
                                <div key={catName}>
                                    <h4 className="text-sm font-bold border-b pb-1 mb-2 text-primary">{catName} ({formatCurrency(data.total)})</h4>
                                    <Table className="text-xs">
                                        <TableBody>
                                            {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                                <TableRow key={sub} className="border-0"><TableCell className="py-1">{sub}</TableCell><TableCell className="text-right py-1 font-mono text-green-600">{formatCurrency(amt)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                            {Object.keys(monthlyReport.incomeByCategory).length === 0 && <div className="text-center py-4 text-muted-foreground text-xs italic">No regular income categories.</div>}
                        </div>
                    </CardContent>
                </Card>

                {/* LOAN TAKEN DETAILS */}
                <Card>
                    <CardHeader><CardTitle>Loan Taken Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanTakenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.loanTakenTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No loans taken.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* REPAYMENT RECEIVED DETAILS */}
                <Card>
                    <CardHeader><CardTitle>Repayment Received Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>From Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentReceivedTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.repaymentReceivedTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No repayments received.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* RIGHT COLUMN: OUTFLOWS */}
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Expense Summary</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Outflow Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow><TableCell>Regular Expenses</TableCell><TableCell className="text-right text-red-600">{formatCurrency(monthlyReport.totalRegularExpense)}</TableCell></TableRow>
                                <TableRow><TableCell>Occasional Expenses</TableCell><TableCell className="text-right text-red-600">{formatCurrency(monthlyReport.totalOccasionalExpense)}</TableCell></TableRow>
                                {monthlyLoanReport.totalLoanGiven > 0 && (<TableRow className="font-medium text-red-600"><TableCell>Total Loan Given</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalRepaymentMade > 0 && (<TableRow className="font-medium text-red-600"><TableCell>Repayment of Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell></TableRow>)}
                                {sbiNetAdjustmentOutflow !== 0 && (<TableRow className="font-medium text-red-600"><TableCell>SBI CC Repay & Adj.</TableCell><TableCell className="text-right">{formatCurrency(sbiNetAdjustmentOutflow)}</TableCell></TableRow>)}
                                {monthlyTransferSummary.total > 0 && (<TableRow className="font-medium text-red-600"><TableCell>External Transfers</TableCell><TableCell className="text-right">{formatCurrency(monthlyTransferSummary.total)}</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Outflow</TableHead><TableHead className="text-right font-mono text-red-600">{formatCurrency(grandTotalOutflow)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                {/* DETAILED REGULAR EXPENSES SECTION */}
                <Card>
                    <CardHeader><CardTitle>Detailed Regular Expenses</CardTitle><CardDescription>Breakdown by category and sub-category.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b]) => b.total - a.total).map(([catName, data]) => (
                                <div key={catName}>
                                    <h4 className="text-sm font-bold border-b pb-1 mb-2 text-red-600">{catName} ({formatCurrency(data.total)})</h4>
                                    <Table className="text-xs">
                                        <TableBody>
                                            {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                                <TableRow key={sub} className="border-0"><TableCell className="py-1">{sub}</TableCell><TableCell className="text-right py-1 font-mono">{formatCurrency(amt)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* DETAILED OCCASIONAL EXPENSES SECTION */}
                <Card>
                    <CardHeader><CardTitle>Detailed Occasional Expenses</CardTitle><CardDescription>Non-recurring or special-month items.</CardDescription></CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {Object.entries(monthlyReport.occasionalExpenseByCategory).sort(([,a],[,b]) => b.total - a.total).map(([catName, data]) => (
                                <div key={catName}>
                                    <h4 className="text-sm font-bold border-b pb-1 mb-2 text-red-600">{catName} ({formatCurrency(data.total)})</h4>
                                    <Table className="text-xs">
                                        <TableBody>
                                            {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                                <TableRow key={sub} className="border-0"><TableCell className="py-1">{sub}</TableCell><TableCell className="text-right py-1 font-mono">{formatCurrency(amt)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))}
                            {Object.keys(monthlyReport.occasionalExpenseByCategory).length === 0 && <div className="text-center py-4 text-muted-foreground text-xs italic">No occasional expenses.</div>}
                        </div>
                    </CardContent>
                </Card>

                {/* LOAN GIVEN DETAILS */}
                <Card>
                    <CardHeader><CardTitle>Loan Given Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanGivenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.loanGivenTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No loans given.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* REPAYMENT MADE DETAILS */}
                <Card>
                    <CardHeader><CardTitle>Repayment Made Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentMadeTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.repaymentMadeTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No repayments made.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* EXTERNAL TRANSFERS DETAILS */}
                <Card>
                    <CardHeader><CardTitle>External Transfer Details</CardTitle><CardDescription>Outflows to non-primary accounts.</CardDescription></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>Target Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyTransferSummary.details.map((t, idx) => (<TableRow key={idx}><TableCell>{t.name}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(t.amount)}</TableCell></TableRow>))}
                                {monthlyTransferSummary.details.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No external transfers.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}

