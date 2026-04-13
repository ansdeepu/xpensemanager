
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp, Tag } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, isValid } from "date-fns";
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
import { Separator } from "@/components/ui/separator";
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

type ReportData = {
  totalIncome: number;
  totalTransfersIn: number;
  totalExpense: number; 
  totalTransfersOut: number;
  totalCreditCardUsage: number;
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

type DetailViewData = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};

type AggregatedEntry = {
    personName: string;
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
  const bankAccountNames = useMemo(() => new Set(accounts.map(a => a.name.toLowerCase())), [accounts]);

  const monthlyTransactions = useMemo(() => {
    const seenIds = new Set<string>();
    return transactions.filter(t => {
        if (seenIds.has(t.id)) return false;
        seenIds.add(t.id);
        const d = new Date(t.date);
        return isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd });
    });
  }, [transactions, monthStart, monthEnd]);

  const { monthlyLoanReport, monthlyTransferSummary } = useMemo(() => {
    const report = {
        totalLoanTaken: 0,
        totalLoanGiven: 0,
        totalRepaymentMade: 0,
        totalRepaymentReceived: 0,
        totalSBILoan: 0,
        totalSBIRepayment: 0,
        loanTakenMap: {} as Record<string, number>,
        loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>,
        repaymentReceivedMap: {} as Record<string, number>,
        sbiLoanTransactions: [] as { id: string, description: string, amount: number }[],
        sbiRepaymentTransactions: [] as { id: string, description: string, amount: number }[],
    };

    let totalTransferOut = 0;
    const transferOutDetails: { name: string, amount: number }[] = [];

    const isInEcosystem = (accId?: string) => 
        Boolean(accId === primaryAccount?.id || accId === 'cash-wallet' || accId === 'digital-wallet' || (accId && creditCardIds.has(accId)));

    loans.forEach(loan => {
        if (bankAccountNames.has(loan.personName.toLowerCase())) return;

        (loan.transactions || []).forEach(tx => {
            const d = new Date(tx.date);
            if (isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
                let include = false;
                if (isOverallSummary) include = true;
                else if (isPrimaryReport) include = Boolean(tx.accountId === accountId || tx.accountId === 'cash-wallet' || tx.accountId === 'digital-wallet' || (tx.accountId && creditCardIds.has(tx.accountId)));
                else include = Boolean(tx.accountId === accountId);

                if (include) {
                    const name = loan.personName;
                    if (loan.type === 'taken') {
                        if (tx.type === 'loan') { report.totalLoanTaken += tx.amount; report.loanTakenMap[name] = (report.loanTakenMap[name] || 0) + tx.amount; }
                        else { report.totalRepaymentMade += tx.amount; report.repaymentMadeMap[name] = (report.repaymentMadeMap[name] || 0) + tx.amount; }
                    } else {
                        if (tx.type === 'loan') { report.totalLoanGiven += tx.amount; report.loanGivenMap[name] = (report.loanGivenMap[name] || 0) + tx.amount; }
                        else { report.totalRepaymentReceived += tx.amount; report.repaymentReceivedMap[name] = (report.repaymentReceivedMap[name] || 0) + tx.amount; }
                    }
                }
            }
        });
    });

    monthlyTransactions.forEach(t => {
        const isSBISpending = t.type === 'expense' && t.accountId === sbiCardId;
        const isSBIRepayment = t.type === 'transfer' && t.toAccountId === sbiCardId;

        let includeInSbi = false;
        if (isOverallSummary) includeInSbi = true;
        else if (isPrimaryReport) includeInSbi = true;
        else includeInSbi = Boolean(t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);

        if (includeInSbi) {
            if (isSBISpending) { report.totalSBILoan += t.amount; report.sbiLoanTransactions.push({ id: t.id, description: t.description, amount: t.amount }); }
            if (isSBIRepayment) { report.totalSBIRepayment += t.amount; report.sbiRepaymentTransactions.push({ id: t.id, description: t.description, amount: t.amount }); }
        }

        if (t.type === 'transfer') {
            const isFromEcosystem = isInEcosystem(t.fromAccountId);
            const isToEcosystem = isInEcosystem(t.toAccountId);
            if (isFromEcosystem && !isToEcosystem && !t.loanTransactionId) {
                const targetAccount = accounts.find(a => a.id === t.toAccountId);
                if (targetAccount) {
                    totalTransferOut += t.amount;
                    transferOutDetails.push({ name: targetAccount.name, amount: t.amount });
                }
            }
        }
    });

    const convertAndSort = (map: Record<string, number>): AggregatedEntry[] => Object.entries(map).map(([personName, amount]) => ({ personName, amount })).sort((a, b) => b.amount - a.amount);

    return {
        monthlyLoanReport: {
            ...report,
            loanTakenTransactions: convertAndSort(report.loanTakenMap),
            loanGivenTransactions: convertAndSort(report.loanGivenMap),
            repaymentMadeTransactions: convertAndSort(report.repaymentMadeMap),
            repaymentReceivedTransactions: convertAndSort(report.repaymentReceivedMap),
        },
        monthlyTransferSummary: { total: totalTransferOut, details: transferOutDetails }
    };
  }, [loans, monthStart, monthEnd, isOverallSummary, isPrimaryReport, accountId, creditCardIds, monthlyTransactions, sbiCardId, bankAccountNames, primaryAccount, accounts]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = {
        totalIncome: 0, totalTransfersIn: 0, totalExpense: 0, totalTransfersOut: 0, totalCreditCardUsage: 0,
        incomeByCategory: {}, expenseByCategory: {}, regularExpenseByCategory: {}, occasionalExpenseByCategory: {},
        totalRegularExpense: 0, totalOccasionalExpense: 0, totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0,
    };
    
    monthlyTransactions.forEach(t => {
        const categoryName = t.category || "Uncategorized";
        const subCategoryName = t.subcategory || "Unspecified";
        const isWalletExpense = Boolean(t.paymentMethod === 'cash' || t.paymentMethod === 'digital');
        
        let include = false;
        if (isOverallSummary) include = true;
        else if (isPrimaryReport) {
            const involvesPrimaryOrWallet = Boolean(t.accountId === accountId || isWalletExpense || t.fromAccountId === accountId || t.toAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet');
            const involvesCreditCard = Boolean((t.accountId && creditCardIds.has(t.accountId)) || (t.fromAccountId && creditCardIds.has(t.fromAccountId)) || (t.toAccountId && creditCardIds.has(t.toAccountId)));
            include = involvesPrimaryOrWallet || involvesCreditCard;
        } else include = Boolean(t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);
        
        if (!include) return;

        if (t.type === 'income') {
            data.totalIncome += t.amount;
            if (!data.incomeByCategory[categoryName]) data.incomeByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
            data.incomeByCategory[categoryName].total += t.amount;
            data.incomeByCategory[categoryName].subcategories[subCategoryName] = (data.incomeByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
        } else if (t.type === 'expense') {
            if (t.accountId && creditCardIds.has(t.accountId)) data.totalCreditCardUsage += t.amount;
            data.totalExpense += t.amount;
            if (!data.expenseByCategory[categoryName]) data.expenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
            data.expenseByCategory[categoryName].total += t.amount;
            data.expenseByCategory[categoryName].subcategories[subCategoryName] = (data.expenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            
            if (t.frequency === 'occasional') {
                data.totalOccasionalExpense += t.amount;
                if (!data.occasionalExpenseByCategory[categoryName]) data.occasionalExpenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                data.occasionalExpenseByCategory[categoryName].total += t.amount;
                data.occasionalExpenseByCategory[categoryName].subcategories[subCategoryName] = (data.occasionalExpenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            } else {
                data.totalRegularExpense += t.amount;
                if (!data.regularExpenseByCategory[categoryName]) data.regularExpenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                data.regularExpenseByCategory[categoryName].total += t.amount;
                data.regularExpenseByCategory[categoryName].subcategories[subCategoryName] = (data.regularExpenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            }
        }
    });

    categories.forEach(cat => {
        const regularBudget = cat.subcategories.filter(sub => sub.frequency === 'monthly').reduce((sum, sub) => sum + (sub.amount || 0), 0);
        const occasionalBudget = cat.subcategories.filter(sub => sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName)).reduce((sum, sub) => sum + (sub.amount || 0), 0);
        const categoryBudget = regularBudget + occasionalBudget;

        if (cat.type === 'expense' || cat.type === 'bank-expense') {
            if (categoryBudget > 0 || cat.subcategories.length > 0) {
                if (!data.regularExpenseByCategory[cat.name]) data.regularExpenseByCategory[cat.name] = { total: 0, budget: 0, subcategories: {} };
                data.regularExpenseByCategory[cat.name].budget = categoryBudget;
                data.totalRegularBudget += categoryBudget;
            }
            data.totalExpenseBudget += categoryBudget;
        } else if (cat.type === 'income') {
            if (data.incomeByCategory[cat.name]) data.incomeByCategory[cat.name].budget = categoryBudget;
            data.totalIncomeBudget += categoryBudget;
        }
    });

    return data;
  }, [monthlyTransactions, isOverallSummary, accountId, isPrimaryReport, categories, currentMonthName, creditCardIds]);

  const handleCategoryClick = (categoryName: string, type: 'income' | 'expense' | 'regular' | 'occasional') => {
    let categoryData;
    if (type === 'income') categoryData = monthlyReport.incomeByCategory[categoryName];
    else if (type === 'expense') categoryData = monthlyReport.expenseByCategory[categoryName];
    else if (type === 'regular') categoryData = monthlyReport.regularExpenseByCategory[categoryName];
    else if (type === 'occasional') categoryData = monthlyReport.occasionalExpenseByCategory[categoryName];
    
    if (categoryData) {
      setSelectedDetail({ name: categoryName, total: categoryData.total, subcategories: categoryData.subcategories });
      setIsDetailDialogOpen(true);
    }
  };

  const handleGenericDetailClick = (title: string, data: { name: string, amount: number }[], total: number) => {
    const subcategories: Record<string, number> = {};
    data.forEach(d => { subcategories[d.name] = (subcategories[d.name] || 0) + d.amount; });
    setSelectedDetail({ name: title, total, subcategories });
    setIsDetailDialogOpen(true);
  };
  
  const grandTotalInflow = monthlyReport.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + monthlyLoanReport.totalSBIRepayment + monthlyTransferSummary.total;
  const netBalance = grandTotalInflow - grandTotalOutflow;

  return (
    <div className="space-y-6">
      {!monthlyTransactions.length ? (
         <Card><CardContent className="pt-6"><div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40"><BookText className="h-10 w-10 mb-2"/><p>No transactions found for {format(currentDate, "MMMM yyyy")}.</p></div></CardContent></Card>
      ) : (
      <>
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
                            <div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</div>
                            <p className="text-xs text-muted-foreground">Category income, loans, and card usage.</p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Income Categories:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalIncome)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Loan Taken:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Repayment of Loan Given:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">SBI Credit Card Loan:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBILoan)}</span></div>
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
                            <div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</div>
                            <p className="text-xs text-muted-foreground">Expenses, repayments, and loans given.</p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expense Categories:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalExpense)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Loan Given:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Repayment of Loan Taken:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">SBI Card Repayment:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBIRepayment)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Transfers:</span><span className="font-semibold">{formatCurrency(monthlyTransferSummary.total)}</span></div>
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
                            <div className={cn("text-2xl font-bold", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>{formatCurrency(netBalance)}</div>
                            <p className="text-xs text-muted-foreground">Inflow - Outflow</p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Inflow:</span><span className="font-semibold text-green-600">{formatCurrency(grandTotalInflow)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Outflow:</span><span className="font-semibold text-red-600">{formatCurrency(grandTotalOutflow)}</span></div>
                            </CollapsibleContent>
                        </CardContent>
                    </Card>
                </CollapsibleTrigger>
            </Collapsible>
        </div>

        <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))} />
        
        <div className="grid gap-6 lg:grid-cols-2 items-start">
            {/* Left Column: Income & Sources */}
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Income Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead>{isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}</TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.incomeByCategory).map(([category, { total, budget }]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'income')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Income</TableHead><TableHead className="text-right">{formatCurrency(monthlyReport.totalIncome)}</TableHead>{isPrimaryReport && <TableHead />}</TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Loan Taken</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanTakenTransactions.length > 0 ? (
                                    monthlyLoanReport.loanTakenTransactions.map(tx => (<TableRow key={tx.personName} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGenericDetailClick('Loan Taken from ' + tx.personName, [], tx.amount)}><TableCell>{tx.personName}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loans taken.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Repayment of Loan Given</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Repayments From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentReceivedTransactions.length > 0 ? (
                                    monthlyLoanReport.repaymentReceivedTransactions.map(tx => (<TableRow key={tx.personName} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGenericDetailClick('Repayment from ' + tx.personName, [], tx.amount)}><TableCell>{tx.personName}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No repayments received.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>SBI Credit Card Loan</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.sbiLoanTransactions.length > 0 ? (
                                    monthlyLoanReport.sbiLoanTransactions.map((tx) => (<TableRow key={tx.id}><TableCell>{tx.description}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No card spending.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Usage</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Expense & Outflows */}
            <div className="space-y-6">
                <Card className="border-primary/50 bg-primary/5 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Expense Details</CardTitle></CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm"><span>Regular Expense Categories</span><span className="font-semibold">{formatCurrency(monthlyReport.totalRegularExpense)}</span></div>
                        <div className="flex justify-between text-sm"><span>Occasional Expense Categories</span><span className="font-semibold">{formatCurrency(monthlyReport.totalOccasionalExpense)}</span></div>
                        <div className="flex justify-between text-sm"><span>Loan Given</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div>
                        <div className="flex justify-between text-sm"><span>Repayment of Loan Taken</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div>
                        <div className="flex justify-between text-sm"><span>SBI Card Repayment</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBIRepayment)}</span></div>
                        <div className="flex justify-between text-sm"><span>Transfer</span><span className="font-semibold">{formatCurrency(monthlyTransferSummary.total)}</span></div>
                        <Separator className="my-2" />
                        <div className="flex justify-between font-bold text-base"><span>Grand Total Outflow</span><span className="font-mono">{formatCurrency(grandTotalOutflow)}</span></div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Transfer</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>To Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyTransferSummary.details.length > 0 ? (
                                    monthlyTransferSummary.details.map((tx, i) => (<TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGenericDetailClick('Transfer to ' + tx.name, [], tx.amount)}><TableCell>{tx.name}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No external transfers.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Transfers</TableHead><TableHead className="text-right">{formatCurrency(monthlyTransferSummary.total)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Regular Expense Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>{isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}</TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'regular')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Occasional Expense Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.occasionalExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total}]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'occasional')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Loan Given</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.loanGivenTransactions.length > 0 ? (
                                    monthlyLoanReport.loanGivenTransactions.map(tx => (<TableRow key={tx.personName} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGenericDetailClick('Loan Given to ' + tx.personName, [], tx.amount)}><TableCell>{tx.personName}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loans given.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Repayment of Loan Taken</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.repaymentMadeTransactions.length > 0 ? (
                                    monthlyLoanReport.repaymentMadeTransactions.map(tx => (<TableRow key={tx.personName} className="cursor-pointer hover:bg-muted/50" onClick={() => handleGenericDetailClick('Repayment to ' + tx.personName, [], tx.amount)}><TableCell>{tx.personName}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No repayments made.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>SBI Credit Card Repayment</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {monthlyLoanReport.sbiRepaymentTransactions.length > 0 ? (
                                    monthlyLoanReport.sbiRepaymentTransactions.map((tx) => (<TableRow key={tx.id}><TableCell>{tx.description}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No card repayments.</TableCell></TableRow>)}
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Repayment</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalSBIRepayment)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
      </>
     )}

     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader><DialogTitle>{selectedDetail?.name} - Detailed Breakdown</DialogTitle><DialogDescription>Detailed view for {format(currentDate, "MMMM yyyy")}.</DialogDescription></DialogHeader>
            <Table>
                <TableHeader><TableRow><TableHead>Detail</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                <TableBody>{selectedDetail && Object.keys(selectedDetail.subcategories).length > 0 ? (Object.entries(selectedDetail.subcategories).sort(([,a],[,b]) => b - a).map(([name, amount]) => (<TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right">{formatCurrency(amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No additional breakdown available.</TableCell></TableRow>)}</TableBody>
                <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold">{formatCurrency(selectedDetail?.total || 0)}</TableHead></TableRow></TableFooter>
            </Table>
             <DialogFooterComponent><DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose></DialogFooterComponent>
        </DialogContent>
    </Dialog>
    </div>
  );
}
