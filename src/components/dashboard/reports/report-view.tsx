
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan, LoanTransaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

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
  
  const [isInflowOpen, setIsInflowOpen] = useState(false);
  const [isOutflowOpen, setIsOutflowOpen] = useState(false);
  const [isNetOpen, setIsNetOpen] = useState(false);

  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const currentMonthName = useMemo(() => format(currentDate, "MMM"), [currentDate]);

  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);
  const creditCardIds = useMemo(() => new Set(accounts.filter(a => a.type === 'card').map(a => a.id)), [accounts]);
  const sbiCardId = useMemo(() => accounts.find(a => a.name?.toLowerCase().includes('sbi') && a.type === 'card')?.id, [accounts]);

  const accountInfo = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const accountName = accountInfo?.name || 'Account';
  const isPostBank = accountName.toLowerCase().includes('post bank');

  // Common logic for All-Time Loan Details
  const allTimeLoanDetails = useMemo(() => {
    // Filter out SBI Credit Card as requested
    const filteredLoans = loans.filter(l => !l.personName?.toLowerCase().includes('sbi credit card'));

    return filteredLoans.map(l => {
        let accountSpecificTransactions: LoanTransaction[] = [];
        
        if (isPrimaryReport) {
            const ecosystemIds = new Set([primaryAccount?.id, 'cash-wallet', 'digital-wallet', ...Array.from(creditCardIds)]);
            accountSpecificTransactions = (l.transactions || []).filter(tx => ecosystemIds.has(tx.accountId));
        } else {
            const isMatchByName = l.personName?.toLowerCase() === accountName.toLowerCase();
            accountSpecificTransactions = (l.transactions || []).filter(tx => tx.accountId === accountId || isMatchByName);
        }

        if (accountSpecificTransactions.length === 0) return null;
        
        const sortedTxs = [...accountSpecificTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        const txsWithRunningBalance = sortedTxs.map(tx => {
            if (tx.type === 'loan') runningBalance += tx.amount;
            else runningBalance -= tx.amount;
            return { ...tx, currentBalance: runningBalance };
        });

        const totalGiven = accountSpecificTransactions.filter(tx => tx.type === 'loan').reduce((sum, tx) => sum + tx.amount, 0);
        const totalRepayment = accountSpecificTransactions.filter(tx => tx.type === 'repayment').reduce((sum, tx) => sum + tx.amount, 0);
        
        // Use "SBI Bank" if the party name matches the current tab's bank name in non-primary reports
        const displayName = (!isPrimaryReport && l.personName?.toLowerCase() === accountName.toLowerCase())
            ? "SBI Bank"
            : l.personName;

        return {
            id: l.id,
            personName: displayName,
            totalGiven,
            totalRepayment,
            balance: totalGiven - totalRepayment,
            transactions: txsWithRunningBalance.reverse()
        };
    }).filter(Boolean);
  }, [loans, isPrimaryReport, primaryAccount, creditCardIds, accountId, accountName]);

  const loanDetailsTotal = useMemo(() => {
    return allTimeLoanDetails.reduce((acc, l) => ({
        totalLoan: acc.totalLoan + (l?.totalGiven || 0),
        totalRepayment: acc.totalRepayment + (l?.totalRepayment || 0),
        balance: acc.balance + (l?.balance || 0)
    }), { totalLoan: 0, totalRepayment: 0, balance: 0 });
  }, [allTimeLoanDetails]);

  if (!isPrimaryReport && accountId) {
    let allTimeInflow = 0;
    let allTimeOutflow = 0;
    const allAccountIncomeDetails: Record<string, number> = {};
    const allAccountExpenseDetails: Record<string, number> = {};
    let totalTransferCredit = 0;
    let totalTransferDebit = 0;
    let totalLoanInflow = 0;
    let totalLoanOutflow = 0;

    transactions.forEach(t => {
        const isRelated = t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;
        if (!isRelated) return;

        if (t.accountId === accountId) {
            if (t.type === 'income') {
                allAccountIncomeDetails[t.category || 'Other'] = (allAccountIncomeDetails[t.category || 'Other'] || 0) + t.amount;
            }
            if (t.type === 'expense') {
                allAccountExpenseDetails[t.category || 'Other'] = (allAccountExpenseDetails[t.category || 'Other'] || 0) + t.amount;
            }
        }
        
        if (t.type === 'transfer') {
            if (t.toAccountId === accountId) {
                if (t.loanTransactionId) totalLoanInflow += t.amount;
                else totalTransferCredit += t.amount;
            }
            if (t.fromAccountId === accountId) {
                if (t.loanTransactionId) totalLoanOutflow += t.amount;
                else totalTransferDebit += t.amount;
            }
        }
    });

    const incomeSum = Object.values(allAccountIncomeDetails).reduce((s, a) => s + a, 0) + totalTransferCredit;
    const expenseSum = Object.values(allAccountExpenseDetails).reduce((s, a) => s + a, 0) + totalTransferDebit;
    allTimeInflow = incomeSum + totalLoanInflow;
    allTimeOutflow = expenseSum + totalLoanOutflow;
    const closingBalance = allTimeInflow - allTimeOutflow;

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

    const postBankCatDoc = categories.find(c => c.name?.toLowerCase() === 'post bank');
    const userDefinedSubFunds = postBankCatDoc ? postBankCatDoc.subcategories.map(s => s.name) : [];
    const combinedPostBankCategories = Array.from(new Set([...userDefinedSubFunds, ...categories.filter(c => c.type === 'income').map(c => c.name)]))
        .filter(name => name?.toLowerCase() !== 'post bank');

    const postBankAccordionData = isPostBank ? combinedPostBankCategories.map(cat => {
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
    }).filter(cat => cat.transactions.length > 0 || userDefinedSubFunds.includes(cat.name)) : [];

    const totalPostBankCredit = postBankAccordionData.reduce((sum, cat) => sum + cat.totalCredit, 0);
    const totalPostBankDebit = postBankAccordionData.reduce((sum, cat) => sum + cat.totalDebit, 0);
    const totalPostBankBalance = totalPostBankCredit - totalPostBankDebit;

    return (
      <div className="space-y-6">
        <Card className="bg-muted/10 border-l-4 border-l-blue-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><BookText className="h-5 w-5" />{accountName} ALL-TIME ACCOUNT SUMMARY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-green-600">Total All-Time Inflow</p><p className="text-xl font-bold font-mono text-green-600">{formatCurrency(allTimeInflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-red-600">Total All-Time Outflow</p><p className="text-xl font-bold font-mono text-red-600">-{formatCurrency(allTimeOutflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold">Current Account Balance</p><p className={cn("text-xl font-bold font-mono", closingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(closingBalance)}</p></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Landmark className="h-5 w-5" />{accountName} MONTHLY STATEMENT SUMMARY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase">Previous Balance</p><p className="text-xl font-bold font-mono">{formatCurrency(prevBal)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-green-600">Monthly Inflow</p><p className="text-xl font-bold font-mono text-green-600">+{formatCurrency(currentInflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold text-red-600">Monthly Outflow</p><p className="text-xl font-bold font-mono text-red-600">-{formatCurrency(currentOutflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold">Closing Balance</p><p className={cn("text-xl font-bold font-mono", monthClosingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(monthClosingBalance)}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <Card>
                <CardHeader><CardTitle>Income Details (All Time)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {Object.entries(allAccountIncomeDetails).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                                <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(amount)}</TableCell></TableRow>
                            ))}
                            {totalTransferCredit > 0 && (
                                <TableRow>
                                    <TableCell className="font-medium">Transfer Credit</TableCell>
                                    <TableCell className="text-right font-mono text-green-600">
                                        {formatCurrency(totalTransferCredit)}
                                        <span className="text-[10px] block font-normal text-muted-foreground italic text-right">Loan credit is not consider</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {Object.keys(allAccountIncomeDetails).length === 0 && totalTransferCredit === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-xs italic">No income records.</TableCell></TableRow>}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Grand Total</TableCell>
                                <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(incomeSum)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Expense Details (All Time)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {Object.entries(allAccountExpenseDetails).sort(([,a],[,b]) => b - a).map(([name, amount]) => (
                                <TableRow key={name}><TableCell className="font-medium">{name}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(amount)}</TableCell></TableRow>
                            ))}
                            {totalTransferDebit > 0 && (
                                <TableRow>
                                    <TableCell className="font-medium">Transfer Debit</TableCell>
                                    <TableCell className="text-right font-mono text-red-600">
                                        {formatCurrency(totalTransferDebit)}
                                        <span className="text-[10px] block font-normal text-muted-foreground italic text-right">Loan debit is not consider</span>
                                    </TableCell>
                                </TableRow>
                            )}
                            {Object.keys(allAccountExpenseDetails).length === 0 && totalTransferDebit === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground text-xs italic">No expense records.</TableCell></TableRow>}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell className="font-bold">Grand Total</TableCell>
                                <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(expenseSum)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>

        <Card className="border-primary border-2">
            <CardHeader><CardTitle>Abstract</CardTitle><CardDescription>High-level financial summary of this account.</CardDescription></CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell className="text-xs font-medium">Total Income Details (All Time)</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(incomeSum)}</TableCell>
                            <TableCell className="text-right font-mono">-</TableCell>
                            <TableCell className="text-right font-mono">{formatCurrency(incomeSum)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="text-xs font-medium">Total Expense Details (All Time)</TableCell>
                            <TableCell className="text-right font-mono">-</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(expenseSum)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">-{formatCurrency(expenseSum)}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell className="text-xs font-medium">Total Loan Details (All Time)</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatCurrency(totalLoanInflow)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatCurrency(totalLoanOutflow)}</TableCell>
                            <TableCell className={cn("text-right font-mono", (totalLoanInflow - totalLoanOutflow) < 0 && "text-red-600")}>{formatCurrency(totalLoanInflow - totalLoanOutflow)}</TableCell>
                        </TableRow>
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Total</TableCell>
                            <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(allTimeInflow)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(allTimeOutflow)}</TableCell>
                            <TableCell className={cn("text-right font-mono font-bold", closingBalance < 0 ? "text-red-600" : "text-primary")}>{formatCurrency(closingBalance)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </CardContent>
        </Card>

        {isPostBank && postBankAccordionData.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>Post Bank Category Breakdown (All Time)</CardTitle>
                    <CardDescription>Passbook status of all sub-funds and income streams within the Post Bank account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-6 p-4 border-2 border-primary/20 rounded-lg bg-muted/10">
                        <Table>
                            <TableFooter>
                                <TableRow className="bg-transparent border-0">
                                    <TableCell className="font-bold text-base">SECTION TOTAL (ALL CATEGORIES)</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold text-base">{formatCurrency(totalPostBankCredit)}</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold text-base">{formatCurrency(totalPostBankDebit)}</TableCell>
                                    <TableCell className={cn("text-right font-mono font-bold text-base", totalPostBankBalance < 0 ? "text-red-600" : "text-primary")}>{formatCurrency(totalPostBankBalance)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                        {postBankAccordionData.map((cat, idx) => (
                            <AccordionItem key={idx} value={`post-${idx}`}>
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex justify-between w-full pr-4">
                                        <span>{cat.name}</span>
                                        <span className={cn("font-bold font-mono", cat.balance >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(cat.balance)}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/30 rounded-lg">
                                        <Table className="text-xs">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right">Credit</TableHead>
                                                    <TableHead className="text-right">Debit</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {cat.transactions.map((tx, i) => (
                                                    <TableRow key={i}>
                                                        <TableCell>{format(new Date(tx.date), 'dd/MM/yy')}</TableCell>
                                                        <TableCell>{tx.description}</TableCell>
                                                        <TableCell className="text-right font-mono text-green-600">{tx.credit ? formatCurrency(tx.credit) : ''}</TableCell>
                                                        <TableCell className="text-right font-mono text-red-600">{tx.debit ? formatCurrency(tx.debit) : ''}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(tx.balance)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                            <TableFooter>
                                                <TableRow>
                                                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(cat.totalCredit)}</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(cat.totalDebit)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold">{formatCurrency(cat.balance)}</TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        )}

        <Card>
            <CardHeader><CardTitle>Loan Details (All Time)</CardTitle></CardHeader>
            <CardContent>
                <div className="mb-6 p-4 border-2 border-primary/20 rounded-lg bg-muted/10">
                    <Table>
                        <TableFooter>
                            <TableRow className="bg-transparent border-0 text-xs">
                                <TableCell className="font-bold">SECTION TOTAL (ALL LOANS)</TableCell>
                                <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(loanDetailsTotal.totalLoan)}</TableCell>
                                <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(loanDetailsTotal.totalRepayment)}</TableCell>
                                <TableCell className={cn("text-right font-mono font-bold", loanDetailsTotal.balance < 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(loanDetailsTotal.balance)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
                <Accordion type="single" collapsible className="w-full">
                    {allTimeLoanDetails.map(loan => (
                        <AccordionItem key={loan!.id} value={loan!.id}>
                            <AccordionTrigger className="py-2 hover:no-underline">
                                <div className="flex justify-between w-full pr-4 text-sm font-medium"><span>{loan!.personName}</span><Badge variant="outline" className="font-mono">{formatCurrency(loan!.balance)}</Badge></div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Table className="text-[10px]">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Loan</TableHead>
                                            <TableHead className="text-right">Repayment</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loan!.transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{format(parseISO(tx.date), 'dd/MM/yy')}</TableCell>
                                                <TableCell className="text-right font-mono text-red-600">{tx.type === 'loan' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">{tx.type === 'repayment' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                <TableCell className="text-right font-mono">{formatCurrency(tx.currentBalance)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell className="font-bold">Total</TableCell>
                                            <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(loan!.totalGiven)}</TableCell>
                                            <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(loan!.totalRepayment)}</TableCell>
                                            <TableCell className="text-right font-mono font-bold">{formatCurrency(loan!.balance)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                    {allTimeLoanDetails.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs italic">No loans recorded.</div>}
                </Accordion>
            </CardContent>
        </Card>
      </div>
    );
  }

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
    const transferOutMap: Record<string, number> = {};
    
    let totalTransferIn = 0;
    const transferInMap: Record<string, number> = {};

    const isInEcosystem = (accId?: string) => accId === primaryAccount?.id || accId === 'cash-wallet' || accId === 'digital-wallet' || (accId && creditCardIds.has(accId));

    loans.forEach(loan => {
        if (loan.personName?.toLowerCase().includes('sbi')) return;
        (loan.transactions || []).forEach(tx => {
            const d = new Date(tx.date);
            if (isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
                let include = (isPrimaryReport && isInEcosystem(tx.accountId));
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
        if (isSBIAccount && isPrimaryReport) {
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
            if (target) { 
                totalTransferOut += t.amount; 
                transferOutMap[target.name] = (transferOutMap[target.name] || 0) + t.amount;
            }
        }
        
        if (t.type === 'transfer' && !isInEcosystem(t.fromAccountId) && isInEcosystem(t.toAccountId) && !t.loanTransactionId) {
            const source = accounts.find(a => a.id === t.fromAccountId);
            if (source) {
                totalTransferIn += t.amount;
                transferInMap[source.name] = (transferInMap[source.name] || 0) + t.amount;
            }
        }
    });

    const sortEntries = (map: Record<string, number>) => Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    const aggregateDetails = (map: Record<string, number>) => {
        const aggregated: Record<string, number> = {};
        Object.entries(map).forEach(([name, amount]) => {
            aggregated[name] = (aggregated[name] || 0) + amount;
        });
        return Object.entries(aggregated).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    };

    return {
        monthlyLoanReport: { ...report, loanTakenTransactions: sortEntries(report.loanTakenMap), loanGivenTransactions: sortEntries(report.loanGivenMap), repaymentMadeTransactions: sortEntries(report.repaymentMadeMap), repaymentReceivedTransactions: sortEntries(report.repaymentReceivedMap) },
        monthlyTransferSummary: { 
            total: totalTransferOut, 
            details: aggregateDetails(transferOutMap),
            totalIn: totalTransferIn,
            detailsIn: aggregateDetails(transferInMap)
        }
    };
  }, [loans, monthlyTransactions, isPrimaryReport, sbiCardId, creditCardIds, primaryAccount, accounts, monthStart, monthEnd]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = { totalIncome: 0, totalExpense: 0, incomeByCategory: {}, expenseByCategory: {}, regularExpenseByCategory: {}, occasionalExpenseByCategory: {}, totalRegularExpense: 0, totalOccasionalExpense: 0, totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0 };
    const bankExpenseNames = new Set(categories.filter(c => c.type === 'bank-expense').map(c => c.name));
    
    monthlyTransactions.forEach(t => {
        let include = (isPrimaryReport && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || (t.accountId && creditCardIds.has(t.accountId))));
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
  }, [monthlyTransactions, isPrimaryReport, accountId, creditCardIds, categories, currentMonthName]);

  const grandTotalInflow = monthlyReport.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan + monthlyLoanReport.totalSBICashback + monthlyTransferSummary.totalIn;
  const sbiOut = monthlyLoanReport.totalSBIRepayment + monthlyLoanReport.totalSBICharges;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + sbiOut + monthlyTransferSummary.total + monthlyLoanReport.totalSBICashback;
  const netBalance = grandTotalInflow - grandTotalOutflow;

  return (
    <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
            <Collapsible open={isInflowOpen} onOpenChange={setIsInflowOpen}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      {isInflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-green-600">{formatCurrency(grandTotalInflow)}</div>
                    <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                      <div className="flex justify-between text-xs"><span>Income:</span><span className="font-mono">{formatCurrency(monthlyReport.totalIncome)}</span></div>
                      <div className="flex justify-between text-xs"><span>Loan Taken:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span></div>
                      <div className="flex justify-between text-xs"><span>Repay. Received:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span></div>
                      <div className="flex justify-between text-xs"><span>Transfer In:</span><span className="font-mono">{formatCurrency(monthlyTransferSummary.totalIn)}</span></div>
                      <div className="flex justify-between text-xs"><span>SBI Usage:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalSBILoan)}</span></div>
                      <div className="flex justify-between text-xs"><span>SBI Cashback:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalSBICashback)}</span></div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
            </Collapsible>

            <Collapsible open={isOutflowOpen} onOpenChange={setIsOutflowOpen}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                    <div className="flex items-center gap-1">
                      <TrendingDown className="h-4 w-4 text-muted-foreground" />
                      {isOutflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-red-600">{formatCurrency(grandTotalOutflow)}</div>
                    <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                      <div className="flex justify-between text-xs"><span>Expenses:</span><span className="font-mono">{formatCurrency(monthlyReport.totalExpense)}</span></div>
                      <div className="flex justify-between text-xs"><span>Loan Given:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div>
                      <div className="flex justify-between text-xs"><span>Repay. Made:</span><span className="font-mono">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div>
                      <div className="flex justify-between text-xs"><span>SBI Card Repay & Adj:</span><span className="font-mono">{formatCurrency(sbiOut + monthlyLoanReport.totalSBICashback)}</span></div>
                      <div className="flex justify-between text-xs"><span>Transfer Out:</span><span className="font-mono">{formatCurrency(monthlyTransferSummary.total)}</span></div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
            </Collapsible>

            <Collapsible open={isNetOpen} onOpenChange={setIsNetOpen}>
              <CollapsibleTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                    <div className="flex items-center gap-1">
                      <IndianRupee className="h-4 w-4 text-muted-foreground" />
                      {isNetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={cn("text-2xl font-bold font-mono", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>{formatCurrency(netBalance)}</div>
                    <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                      <div className="flex justify-between text-xs"><span>Inflow:</span><span className="text-green-600 font-mono">{formatCurrency(grandTotalInflow)}</span></div>
                      <div className="flex justify-between text-xs"><span>Outflow:</span><span className="text-red-600 font-mono">{formatCurrency(grandTotalOutflow)}</span></div>
                    </CollapsibleContent>
                  </CardContent>
                </Card>
              </CollapsibleTrigger>
            </Collapsible>
        </div>

        <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k,v]) => [k, v.total]))} />

        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Income Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.incomeByCategory).map(([cat, { total }]) => (
                                    <TableRow key={cat}><TableCell className="font-medium">{cat}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(total)}</TableCell></TableRow>
                                ))}
                                <TableRow className="font-medium text-green-600">
                                    <TableCell>Repayment Received</TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell>
                                </TableRow>
                                <TableRow className="font-medium text-green-600">
                                    <TableCell>Transfer Credit</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatCurrency(monthlyTransferSummary.totalIn)}
                                        <span className="text-[10px] block font-normal text-muted-foreground italic text-right">Loan credit is not consider</span>
                                    </TableCell>
                                </TableRow>
                                {monthlyLoanReport.totalLoanTaken > 0 && (<TableRow className="font-medium text-green-600"><TableCell>Loan Taken</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalSBILoan > 0 && (<TableRow className="font-medium text-green-600"><TableCell>SBI Credit Card Usage</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalSBICashback > 0 && (<TableRow className="font-medium text-green-600"><TableCell>SBI Credit Card Cashback</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Inflow</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(grandTotalInflow)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Detailed Income Breakdown</CardTitle><CardDescription>Itemized sources for each income category.</CardDescription></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableBody>
                                {Object.entries(monthlyReport.incomeByCategory).map(([catName, data]) => (
                                    <React.Fragment key={catName}>
                                        <TableRow className="bg-muted/50"><TableCell colSpan={2} className="font-bold text-primary">{catName}</TableCell></TableRow>
                                        {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                            <TableRow key={sub} className="border-0"><TableCell className="pl-6">{sub}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(amt)}</TableCell></TableRow>
                                        ))}
                                    </React.Fragment>
                                ))}
                                {Object.keys(monthlyReport.incomeByCategory).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No regular income categories.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Grand Total Income</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-green-600">{formatCurrency(monthlyReport.totalIncome)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>SBI Credit Card Usage Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.sbiLoanTransactions.map((tx, idx) => (<TableRow key={idx}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.sbiLoanTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No usage recorded.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Usage</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>SBI Credit Card Cashback Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.sbiCashbackTransactions.map((tx, idx) => (<TableRow key={idx}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.sbiCashbackTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No cashback recorded.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Cashback</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Loan Taken Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanTakenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.loanTakenTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No loans taken.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Taken</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Repayment Received Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>From Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentReceivedTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.repaymentReceivedTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No repayments received.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Received</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Transfer Credit Details</CardTitle>
                        <CardDescription>Itemized inflows from external accounts into the Primary Ecosystem.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source Account</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyTransferSummary.detailsIn.map(tx => (
                                    <TableRow key={tx.name}>
                                        <TableCell>{tx.name}</TableCell>
                                        <TableCell className="text-right font-mono text-green-600">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {monthlyTransferSummary.detailsIn.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No external transfer credits.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Transfer In</TableCell>
                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(monthlyTransferSummary.totalIn)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Loan Details (All Time)</CardTitle>
                        <CardDescription>Comprehensive history of all loans linked to your Primary Ecosystem.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6 p-4 border-2 border-primary/20 rounded-lg bg-muted/10">
                            <Table>
                                <TableFooter>
                                    <TableRow className="bg-transparent border-0 text-xs">
                                        <TableCell className="font-bold">SECTION TOTAL (ALL LOANS)</TableCell>
                                        <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(loanDetailsTotal.totalLoan)}</TableCell>
                                        <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(loanDetailsTotal.totalRepayment)}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-bold", loanDetailsTotal.balance < 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(loanDetailsTotal.balance)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                        <Accordion type="single" collapsible className="w-full">
                            {allTimeLoanDetails.map(loan => (
                                <AccordionItem key={loan!.id} value={loan!.id}>
                                    <AccordionTrigger className="py-2 hover:no-underline">
                                        <div className="flex justify-between w-full pr-4 text-sm font-medium">
                                            <span>{loan!.personName}</span>
                                            <Badge variant="outline" className="font-mono">{formatCurrency(loan!.balance)}</Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table className="text-[10px]">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead className="text-right">Loan</TableHead>
                                                    <TableHead className="text-right">Repayment</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loan!.transactions.map(tx => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{format(parseISO(tx.date), 'dd/MM/yy')}</TableCell>
                                                        <TableCell className="text-right font-mono text-red-600">{tx.type === 'loan' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                        <TableCell className="text-right font-mono text-green-600">{tx.type === 'repayment' ? formatCurrency(tx.amount) : ''}</TableCell>
                                                        <TableCell className="text-right font-mono">{formatCurrency(tx.currentBalance)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                            <TableFooter>
                                                <TableRow>
                                                    <TableCell className="font-bold">Total</TableCell>
                                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(loan!.totalGiven)}</TableCell>
                                                    <TableCell className="text-right font-mono text-green-600 font-bold">{formatCurrency(loan!.totalRepayment)}</TableCell>
                                                    <TableCell className="text-right font-mono font-bold">{formatCurrency(loan!.balance)}</TableCell>
                                                </TableRow>
                                            </TableFooter>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                            {allTimeLoanDetails.length === 0 && <div className="text-center py-10 text-muted-foreground text-xs italic">No loans recorded.</div>}
                        </Accordion>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Expense Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Outflow Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow><TableCell>Regular Expenses</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(monthlyReport.totalRegularExpense)}</TableCell></TableRow>
                                <TableRow><TableCell>Occasional Expenses</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(monthlyReport.totalOccasionalExpense)}</TableCell></TableRow>
                                {monthlyLoanReport.totalLoanGiven > 0 && (<TableRow className="font-medium text-red-600"><TableCell>Loan Given</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell></TableRow>)}
                                {monthlyLoanReport.totalRepaymentMade > 0 && (<TableRow className="font-medium text-red-600"><TableCell>Repayment Made</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell></TableRow>)}
                                {(sbiOut + monthlyLoanReport.totalSBICashback > 0) && (<TableRow className="font-medium text-red-600"><TableCell>SBI Credit Card Repayment</TableCell><TableCell className="text-right font-mono">{formatCurrency(sbiOut + monthlyLoanReport.totalSBICashback)}</TableCell></TableRow>)}
                                {monthlyTransferSummary.total > 0 && (<TableRow className="font-medium text-red-600"><TableCell>Transfer Out</TableCell><TableCell className="text-right font-mono">{formatCurrency(monthlyTransferSummary.total)}</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Outflow</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(grandTotalOutflow)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Detailed Regular Expenses</CardTitle><CardDescription>Breakdown by category and sub-category.</CardDescription></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableBody>
                                {Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b]) => b.total - a.total).map(([catName, data]) => (
                                    <React.Fragment key={catName}>
                                        <TableRow className="bg-muted/50"><TableCell colSpan={2} className="font-bold text-red-600">{catName}</TableCell></TableRow>
                                        {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                            <TableRow key={sub} className="border-0"><TableCell className="pl-6">{sub}</TableCell><TableCell className="text-right font-mono">{formatCurrency(amt)}</TableCell></TableRow>
                                        ))}
                                    </React.Fragment>
                                ))}
                                {Object.keys(monthlyReport.regularExpenseByCategory).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No regular expenses recorded.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Regular Expenses</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(monthlyReport.totalRegularExpense)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Detailed Occasional Expenses</CardTitle><CardDescription>Non-recurring or special-month items.</CardDescription></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableBody>
                                {Object.entries(monthlyReport.occasionalExpenseByCategory).sort(([,a],[,b]) => b.total - a.total).map(([catName, data]) => (
                                    <React.Fragment key={catName}>
                                        <TableRow className="bg-muted/50"><TableCell colSpan={2} className="font-bold text-red-600">{catName}</TableCell></TableRow>
                                        {Object.entries(data.subcategories).sort(([,a],[,b]) => b - a).map(([sub, amt]) => (
                                            <TableRow key={sub} className="border-0"><TableCell className="pl-6">{sub}</TableCell><TableCell className="text-right font-mono">{formatCurrency(amt)}</TableCell></TableRow>
                                        ))}
                                    </React.Fragment>
                                ))}
                                {Object.keys(monthlyReport.occasionalExpenseByCategory).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No occasional expenses.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Occasional Expenses</TableCell>
                                    <TableCell className="text-right font-mono font-bold text-red-600">{formatCurrency(monthlyReport.totalOccasionalExpense)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>SBI Credit Card Repayment</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.sbiRepaymentTransactions.map((tx, idx) => (<TableRow key={`rep-${idx}`}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.sbiChargesTransactions.map((tx, idx) => (<TableRow key={`chg-${idx}`}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.sbiCashbackTransactions.map((tx, idx) => (<TableRow key={`cb-out-${idx}`}><TableCell>{tx.name} (Cashback)</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {(monthlyLoanReport.sbiRepaymentTransactions.length === 0 && monthlyLoanReport.sbiChargesTransactions.length === 0 && monthlyLoanReport.sbiCashbackTransactions.length === 0) && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No repayment activities recorded.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Repayment & Adj.</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(sbiOut + monthlyLoanReport.totalSBICashback)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Loan Given Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanGivenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.loanGivenTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No loans given.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Given</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Repayment Made Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentMadeTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))}
                                {monthlyLoanReport.repaymentMadeTransactions.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No repayments made.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Made</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>External Transfer Details</CardTitle><CardDescription>Outflows from the Primary Ecosystem to external bank accounts.</CardDescription></CardHeader>
                    <CardContent>
                        <Table className="text-xs">
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Target Account</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {monthlyTransferSummary.details.map((t, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{t.name}</TableCell>
                                        <TableCell className="text-right font-mono text-red-600">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))}
                                {monthlyTransferSummary.details.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground italic">No external transfers.</TableCell></TableRow>}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Transfer Out</TableCell>
                                    <TableCell className="text-right font-mono text-red-600 font-bold">{formatCurrency(monthlyTransferSummary.total)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}

