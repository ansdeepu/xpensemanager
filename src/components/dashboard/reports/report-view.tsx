"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, isValid, isBefore } from "date-fns";
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
  DialogDescription,
  DialogFooter as DialogFooterComponent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useReportDate } from "@/context/report-date-context";
import { FinancialAdvice } from "./financial-advice";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(val);
};

type CategoryBreakdown = {
  [key: string]: { total: number; budget: number; subcategories: { [key: string]: number } } 
};

type DetailViewData = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};

type AggregatedEntry = {
    name: string;
    amount: number;
};

// Post Bank categories logic
const postBankCategories = [
  'Diesel Collection', 'Staff Club Accounts', 'Ente Keralam Accounts', 'Seminar Accounts', 
  'Jayaram Treatment', 'SLR Retirement - Jan 2026', 'Bank Charges', 'Deepa Car Accounts'
];

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
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<DetailViewData | null>(null);
  const [isInflowOpen, setIsInflowOpen] = useState(false);
  const [isOutflowOpen, setIsOutflowOpen] = useState(false);
  const [isNetOpen, setIsNetOpen] = useState(false);

  const { currentDate } = useReportDate();
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const currentMonthName = useMemo(() => format(currentDate, "MMM"), [currentDate]);

  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);
  const creditCardIds = useMemo(() => new Set(accounts.filter(a => a.type === 'card').map(a => a.id)), [accounts]);
  const sbiCardId = useMemo(() => accounts.find(a => a.type === 'card' && a.name.toLowerCase().includes('sbi'))?.id, [accounts]);

  const isPostBank = useMemo(() => {
    const acc = accounts.find(a => a.id === accountId);
    return acc?.name.toLowerCase().includes('post bank');
  }, [accounts, accountId]);

  // Unified Transaction Processing
  const { 
    monthlyTransactions, 
    previousBalance,
    monthlyLoanReport, 
    monthlyTransferSummary,
    monthlyStats
  } = useMemo(() => {
    let prevBal = 0;
    const processedTxs: Transaction[] = [];
    
    const stats = {
        totalIncome: 0, totalExpense: 0, totalRegularExpense: 0, totalOccasionalExpense: 0,
        totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0,
        incomeByCategory: {} as CategoryBreakdown,
        expenseByCategory: {} as CategoryBreakdown,
        regularExpenseByCategory: {} as CategoryBreakdown,
        occasionalExpenseByCategory: {} as CategoryBreakdown,
    };

    const loanReport = {
        totalLoanTaken: 0, totalLoanGiven: 0, totalRepaymentMade: 0, totalRepaymentReceived: 0,
        totalSBILoan: 0, totalSBIRepayment: 0, totalSBICashback: 0, totalSBICharges: 0,
        loanTakenMap: {} as Record<string, number>, loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>, repaymentReceivedMap: {} as Record<string, number>,
        sbiLoanTransactions: [] as AggregatedEntry[], sbiRepaymentTransactions: [] as AggregatedEntry[],
        sbiCashbackTransactions: [] as AggregatedEntry[], sbiChargesTransactions: [] as AggregatedEntry[],
    };

    let totalTransferOut = 0;
    const transferOutDetails: AggregatedEntry[] = [];
    const bankExpenseCategoryNames = new Set(categories.filter(c => c.type === 'bank-expense').map(c => c.name));

    // 1. Sort and process chronological balance
    const chronological = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chronological.forEach(t => {
        const d = new Date(t.date);
        if (!isValid(d)) return;

        let affectedThisTab = false;
        if (isOverallSummary) affectedThisTab = true;
        else if (isPrimaryReport) {
            affectedThisTab = Boolean(t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || t.fromAccountId === accountId || t.toAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet' || (t.accountId && creditCardIds.has(t.accountId)) || (t.fromAccountId && creditCardIds.has(t.fromAccountId)) || (t.toAccountId && creditCardIds.has(t.toAccountId)));
        } else {
            affectedThisTab = Boolean(t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);
        }

        if (!affectedThisTab) return;

        // Calculate effect for specific account balance tracking
        let effect = 0;
        if (accountId && !isPrimaryReport) {
            if (t.type === 'income' && t.accountId === accountId) effect = t.amount;
            else if (t.type === 'expense' && t.accountId === accountId) effect = -t.amount;
            else if (t.type === 'transfer') {
                if (t.toAccountId === accountId) effect = t.amount;
                if (t.fromAccountId === accountId) effect = -t.amount;
            }
        }

        if (isBefore(d, monthStart)) {
            prevBal += effect;
        } else if (isWithinInterval(d, { start: monthStart, end: monthEnd })) {
            processedTxs.push(t);
            
            // Core Reporting logic
            if (t.type === 'income') {
                stats.totalIncome += t.amount;
                const cat = t.category || "Uncategorized";
                if (!stats.incomeByCategory[cat]) stats.incomeByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                stats.incomeByCategory[cat].total += t.amount;
                stats.incomeByCategory[cat].subcategories[t.subcategory || "Other"] = (stats.incomeByCategory[cat].subcategories[t.subcategory || "Other"] || 0) + t.amount;
            } else if (t.type === 'expense') {
                if (!bankExpenseCategoryNames.has(t.category || "")) {
                    stats.totalExpense += t.amount;
                    const cat = t.category || "Uncategorized";
                    if (!stats.expenseByCategory[cat]) stats.expenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                    stats.expenseByCategory[cat].total += t.amount;
                    stats.expenseByCategory[cat].subcategories[t.subcategory || "Other"] = (stats.expenseByCategory[cat].subcategories[t.subcategory || "Other"] || 0) + t.amount;
                    
                    if (t.frequency === 'occasional') {
                        stats.totalOccasionalExpense += t.amount;
                        if (!stats.occasionalExpenseByCategory[cat]) stats.occasionalExpenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                        stats.occasionalExpenseByCategory[cat].total += t.amount;
                    } else {
                        stats.totalRegularExpense += t.amount;
                        if (!stats.regularExpenseByCategory[cat]) stats.regularExpenseByCategory[cat] = { total: 0, budget: 0, subcategories: {} };
                        stats.regularExpenseByCategory[cat].total += t.amount;
                    }
                }
            }

            // Loan & SBI Tracking (Detailed)
            const isSBIAccount = t.accountId === sbiCardId || t.fromAccountId === sbiCardId || t.toAccountId === sbiCardId;
            if (isSBIAccount) {
                const isSBICashback = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId === 'cashback-source';
                const isSBIRepayment = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId !== 'cashback-source' && !creditCardIds.has(t.fromAccountId!);
                const isSBICharge = t.type === 'expense' && t.accountId === sbiCardId && t.category?.toLowerCase().includes('charge');
                const isSBILoan = (t.type === 'expense' && t.accountId === sbiCardId && !isSBICharge) || (t.type === 'transfer' && t.fromAccountId === sbiCardId);

                if (isSBILoan) { loanReport.totalSBILoan += t.amount; loanReport.sbiLoanTransactions.push({ name: t.description, amount: t.amount }); }
                if (isSBIRepayment) { loanReport.totalSBIRepayment += t.amount; loanReport.sbiRepaymentTransactions.push({ name: t.description, amount: t.amount }); }
                if (isSBICashback) { loanReport.totalSBICashback += t.amount; loanReport.sbiCashbackTransactions.push({ name: t.description, amount: t.amount }); }
                if (isSBICharge) { loanReport.totalSBICharges += t.amount; loanReport.sbiChargesTransactions.push({ name: t.description, amount: t.amount }); }
            }

            // Transfers Out of Ecosystem
            if (t.type === 'transfer' && !t.loanTransactionId) {
                const isInEcosystem = (id?: string) => Boolean(id === primaryAccount?.id || id === 'cash-wallet' || id === 'digital-wallet' || (id && creditCardIds.has(id)));
                if (isInEcosystem(t.fromAccountId) && !isInEcosystem(t.toAccountId)) {
                    const target = accounts.find(a => a.id === t.toAccountId);
                    if (target) {
                        totalTransferOut += t.amount;
                        transferOutDetails.push({ name: target.name, amount: t.amount });
                    }
                }
            }
        }
    });

    // Process loans from the loan collection
    loans.forEach(loan => {
        if (loan.personName.toLowerCase().includes('sbi')) return;
        (loan.transactions || []).forEach(tx => {
            const d = new Date(tx.date);
            if (isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
                if (loan.type === 'taken') {
                    if (tx.type === 'loan') {
                        loanReport.totalLoanTaken += tx.amount;
                        loanReport.loanTakenMap[loan.personName] = (loanReport.loanTakenMap[loan.personName] || 0) + tx.amount;
                    } else {
                        loanReport.totalRepaymentMade += tx.amount;
                        loanReport.repaymentMadeMap[loan.personName] = (loanReport.repaymentMadeMap[loan.personName] || 0) + tx.amount;
                    }
                } else {
                    if (tx.type === 'loan') {
                        loanReport.totalLoanGiven += tx.amount;
                        loanReport.loanGivenMap[loan.personName] = (loanReport.loanGivenMap[loan.personName] || 0) + tx.amount;
                    } else {
                        loanReport.totalRepaymentReceived += tx.amount;
                        loanReport.repaymentReceivedMap[loan.personName] = (loanReport.repaymentReceivedMap[loan.personName] || 0) + tx.amount;
                    }
                }
            }
        });
    });

    // Budgets
    categories.forEach(cat => {
        const categoryBudget = cat.subcategories
            .filter(sub => sub.frequency === 'monthly' || (sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName)))
            .reduce((sum, sub) => sum + (sub.amount || 0), 0);
        if (cat.type === 'expense' && stats.expenseByCategory[cat.name]) stats.expenseByCategory[cat.name].budget = categoryBudget;
        if (cat.type === 'income' && stats.incomeByCategory[cat.name]) stats.incomeByCategory[cat.name].budget = categoryBudget;
    });

    const mapToSorted = (map: Record<string, number>) => Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount - a.amount);

    return { 
        monthlyTransactions: processedTxs,
        previousBalance: prevBal,
        monthlyLoanReport: {
            ...loanReport,
            loanTakenTransactions: mapToSorted(loanReport.loanTakenMap),
            loanGivenTransactions: mapToSorted(loanReport.loanGivenMap),
            repaymentMadeTransactions: mapToSorted(loanReport.repaymentMadeMap),
            repaymentReceivedTransactions: mapToSorted(loanReport.repaymentReceivedMap),
        },
        monthlyTransferSummary: { total: totalTransferOut, details: transferOutDetails },
        monthlyStats: stats
    };
  }, [transactions, categories, loans, monthStart, monthEnd, currentMonthName, isOverallSummary, isPrimaryReport, accountId, primaryAccount, creditCardIds, sbiCardId]);

  // Grand Totals Logic (Consistent with User preference)
  const grandTotalInflow = monthlyStats.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan + monthlyLoanReport.totalSBICashback;
  const sbiAdj = monthlyLoanReport.totalSBIRepayment + monthlyLoanReport.totalSBICharges + monthlyLoanReport.totalSBICashback;
  const grandTotalOutflow = monthlyStats.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + sbiAdj + monthlyTransferSummary.total;
  const netBalance = grandTotalInflow - grandTotalOutflow;

  const handleDetailClick = (name: string, type: 'income' | 'expense' | 'loan' | 'transfer', data?: any) => {
    if (type === 'income') setSelectedDetail({ name, total: monthlyStats.incomeByCategory[name]?.total, subcategories: monthlyStats.incomeByCategory[name]?.subcategories });
    else if (type === 'expense') setSelectedDetail({ name, total: monthlyStats.expenseByCategory[name]?.total, subcategories: monthlyStats.expenseByCategory[name]?.subcategories });
    else if (data) {
        const sub: Record<string, number> = {};
        data.forEach((d: any) => sub[d.name] = (sub[d.name] || 0) + d.amount);
        setSelectedDetail({ name, total: data.reduce((s: number, d: any) => s + d.amount, 0), subcategories: sub });
    }
    setIsDetailDialogOpen(true);
  };

  // --- RENDERING ---

  // Design A: Primary / Overall Summary (Two Columns)
  if (isOverallSummary || isPrimaryReport) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Inflow</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Outflow</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</div></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Balance</CardTitle></CardHeader><CardContent><div className={cn("text-2xl font-bold", netBalance >= 0 ? "text-foreground" : "text-red-600")}>{formatCurrency(netBalance)}</div></CardContent></Card>
            </div>

            <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyStats.expenseByCategory).map(([k, v]) => [k, v.total]))} />

            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Income Details (Sources of Funds)</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyStats.incomeByCategory).map(([k, v]) => (
                                    <TableRow key={k} onClick={() => handleDetailClick(k, 'income')} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>{k}</TableCell><TableCell className="text-right">{formatCurrency(v.total)}</TableCell>
                                    </TableRow>
                                ))}
                                {monthlyLoanReport.totalLoanTaken > 0 && (
                                    <TableRow onClick={() => handleDetailClick('Loan Taken', 'loan', monthlyLoanReport.loanTakenTransactions)} className="cursor-pointer hover:bg-muted/50 text-green-600">
                                        <TableCell>Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell>
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalRepaymentReceived > 0 && (
                                    <TableRow onClick={() => handleDetailClick('Repayment Received', 'loan', monthlyLoanReport.repaymentReceivedTransactions)} className="cursor-pointer hover:bg-muted/50 text-green-600">
                                        <TableCell>Repayment Received</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell>
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalSBILoan > 0 && (
                                    <TableRow onClick={() => handleDetailClick('SBI Credit Card Loan', 'loan', monthlyLoanReport.sbiLoanTransactions)} className="cursor-pointer hover:bg-muted/50 text-green-600">
                                        <TableCell>SBI Credit Card Loan</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell>
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalSBICashback > 0 && (
                                    <TableRow onClick={() => handleDetailClick('SBI Credit Card Cashback', 'loan', monthlyLoanReport.sbiCashbackTransactions)} className="cursor-pointer hover:bg-muted/50 text-green-600">
                                        <TableCell>SBI Credit Card Cashback</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter><TableRow><TableCell className="font-bold">Total Inflow</TableCell><TableCell className="text-right font-bold">{formatCurrency(grandTotalInflow)}</TableCell></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="bg-card">
                    <CardHeader><CardTitle>Expense Details (Uses of Funds)</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyStats.expenseByCategory).sort(([,a],[,b]) => b.total - a.total).map(([k, v]) => (
                                    <TableRow key={k} onClick={() => handleDetailClick(k, 'expense')} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>{k}</TableCell><TableCell className="text-right">{formatCurrency(v.total)}</TableCell>
                                    </TableRow>
                                ))}
                                {monthlyLoanReport.totalLoanGiven > 0 && (
                                    <TableRow onClick={() => handleDetailClick('Loan Given', 'loan', monthlyLoanReport.loanGivenTransactions)} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>Loan Given</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell>
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalRepaymentMade > 0 && (
                                    <TableRow onClick={() => handleDetailClick('Repayment Made', 'loan', monthlyLoanReport.repaymentMadeTransactions)} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>Repayment of Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell>
                                    </TableRow>
                                )}
                                {sbiAdj > 0 && (
                                    <TableRow onClick={() => handleDetailClick('SBI Card Repayment & Adj', 'loan', [...monthlyLoanReport.sbiRepaymentTransactions, ...monthlyLoanReport.sbiChargesTransactions, ...monthlyLoanReport.sbiCashbackTransactions])} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>SBI Credit Card Repayment & Adj.</TableCell><TableCell className="text-right">{formatCurrency(sbiAdj)}</TableCell>
                                    </TableRow>
                                )}
                                {monthlyTransferSummary.total > 0 && (
                                    <TableRow onClick={() => handleDetailClick('Transfers', 'transfer', monthlyTransferSummary.details)} className="cursor-pointer hover:bg-muted/50">
                                        <TableCell>Transfer</TableCell><TableCell className="text-right">{formatCurrency(monthlyTransferSummary.total)}</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter><TableRow><TableCell className="font-bold">Total Outflow</TableCell><TableCell className="text-right font-bold">{formatCurrency(grandTotalOutflow)}</TableCell></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Sub-category Dialog */}
            <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>{selectedDetail?.name} Breakdown</DialogTitle></DialogHeader>
                    <Table>
                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {selectedDetail && Object.entries(selectedDetail.subcategories).sort(([,a],[,b]) => b - a).map(([name, val]) => (
                                <TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right font-mono">{formatCurrency(val)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                        <TableFooter><TableRow><TableCell className="font-bold">Total</TableCell><TableCell className="text-right font-bold">{formatCurrency(selectedDetail?.total || 0)}</TableCell></TableRow></TableFooter>
                    </Table>
                    <DialogFooterComponent><DialogClose asChild><Button variant="secondary">Close</Button></DialogClose></DialogFooterComponent>
                </DialogContent>
            </Dialog>
        </div>
    );
  }

  // Design B: Statement passbook for FED, HDFC, POST (Opening/Closing Balance)
  const monthlyInflow = monthlyStats.totalIncome + processedTransactionsEffect(monthlyTransactions, 'inflow', accountId!);
  const monthlyOutflow = monthlyStats.totalExpense + processedTransactionsEffect(monthlyTransactions, 'outflow', accountId!);
  const closingBalance = previousBalance + monthlyInflow - monthlyOutflow;

  function processedTransactionsEffect(txs: Transaction[], type: 'inflow' | 'outflow', accId: string) {
    return txs.reduce((sum, t) => {
        let val = 0;
        if (type === 'inflow') {
            if (t.type === 'income' && t.accountId === accId) val = t.amount;
            else if (t.type === 'transfer' && t.toAccountId === accId) val = t.amount;
        } else {
            if (t.type === 'expense' && t.accountId === accId) val = t.amount;
            else if (t.type === 'transfer' && t.fromAccountId === accId) val = t.amount;
        }
        return sum + val;
    }, 0);
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader><CardTitle>Monthly Statement Summary</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
                <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Previous Balance</p>
                    <p className="text-xl font-bold">{formatCurrency(previousBalance)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Inflow</p>
                    <p className="text-xl font-bold text-green-600">+{formatCurrency(monthlyInflow)}</p>
                </div>
                <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Outflow</p>
                    <p className="text-xl font-bold text-red-600">-{formatCurrency(monthlyOutflow)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-muted">
                    <p className="text-sm text-muted-foreground">Closing Balance</p>
                    <p className="text-xl font-bold">{formatCurrency(closingBalance)}</p>
                </div>
            </CardContent>
        </Card>

        {isPostBank ? (
            <Card>
                <CardHeader><CardTitle>Post Bank Category Breakdown</CardTitle></CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {postBankCategories.map(catName => {
                            const catTxs = monthlyTransactions.filter(t => (t.category === catName || t.subcategory === catName || t.description?.toLowerCase().includes(catName.toLowerCase())));
                            const inflow = processedTransactionsEffect(catTxs, 'inflow', accountId!);
                            const outflow = processedTransactionsEffect(catTxs, 'outflow', accountId!);
                            const bal = inflow - outflow;
                            return (
                                <AccordionItem key={catName} value={catName}>
                                    <AccordionTrigger className="hover:no-underline">
                                        <div className="flex justify-between w-full pr-4">
                                            <span>{catName}</span>
                                            <span className={cn("font-bold", bal >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(bal)}</span>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Debit</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {catTxs.map(t => (
                                                    <TableRow key={t.id}>
                                                        <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                                                        <TableCell>{t.description}</TableCell>
                                                        <TableCell className="text-right text-green-600">{(t.type === 'income' || t.toAccountId === accountId) ? formatCurrency(t.amount) : '-'}</TableCell>
                                                        <TableCell className="text-right text-red-600">{(t.type === 'expense' || t.fromAccountId === accountId) ? formatCurrency(t.amount) : '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Statement of Inflow</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyTransactions.filter(t => (t.type === 'income' && t.accountId === accountId) || (t.type === 'transfer' && t.toAccountId === accountId)).map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), 'dd/MM')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className="text-right text-green-600">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Statement of Outflow</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyTransactions.filter(t => (t.type === 'expense' && t.accountId === accountId) || (t.type === 'transfer' && t.fromAccountId === accountId)).map(t => (
                                    <TableRow key={t.id}>
                                        <TableCell>{format(new Date(t.date), 'dd/MM')}</TableCell>
                                        <TableCell>{t.description}</TableCell>
                                        <TableCell className="text-right text-red-600">{formatCurrency(t.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
  );
}

// Re-defining sub-components locally for robustness if missing
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";