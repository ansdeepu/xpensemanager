
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, SubCategory, Account, Loan, LoanTransaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
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
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type CategoryBreakdown = {
  [key: string]: { total: number; budget: number; subcategories: { [key: string]: number } } 
};

type ReportData = {
  totalIncome: number;
  totalTransfersIn: number;
  totalExpense: number; 
  totalTransfersOut: number;
  incomeByCategory: CategoryBreakdown;
  expenseByCategory: CategoryBreakdown; 
  regularExpenseByCategory: CategoryBreakdown;
  occasionalExpenseByCategory: CategoryBreakdown;
  totalRegularExpense: number;
  totalOccasionalExpense: number;
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  transferInTransactions: Transaction[];
  transferOutTransactions: Transaction[];
  totalIncomeBudget: number;
  totalExpenseBudget: number;
  totalRegularBudget: number;
  totalOccasionalBudget: number;
};

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};

type AggregatedLoanEntry = {
    personName: string;
    amount: number;
};


export function ReportView({ transactions, categories, accounts, loans, isOverallSummary, accountId, isPrimaryReport }: { transactions: Transaction[], categories: Category[], accounts: Account[], loans: Loan[], isOverallSummary: boolean, accountId?: string, isPrimaryReport?: boolean }) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);
  
  const [isInflowOpen, setIsInflowOpen] = useState(false);
  const [isOutflowOpen, setIsOutflowOpen] = useState(false);
  const [isNetOpen, setIsNetOpen] = useState(false);

  const { currentDate } = useReportDate();
  
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const currentMonthName = useMemo(() => format(currentDate, "MMM"), [currentDate]);

  const creditCardIds = useMemo(() => new Set(accounts.filter(a => a.type === 'card').map(a => a.id)), [accounts]);

  const monthlyTransactions = useMemo(() => 
    transactions.filter(t => isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })),
    [transactions, monthStart, monthEnd]
  );
  
  const monthlyLoanReport = useMemo(() => {
    const report = {
        totalLoanTaken: 0,
        totalLoanGiven: 0,
        totalRepaymentMade: 0,
        totalRepaymentReceived: 0,
        loanTakenMap: {} as Record<string, number>,
        loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>,
        repaymentReceivedMap: {} as Record<string, number>,
    };

    if (!loans) return {
        totalLoanTaken: 0,
        totalLoanGiven: 0,
        totalRepaymentMade: 0,
        totalRepaymentReceived: 0,
        loanTakenTransactions: [],
        loanGivenTransactions: [],
        repaymentMadeTransactions: [],
        repaymentReceivedTransactions: [],
    };

    loans.forEach(loan => {
        (loan.transactions || []).forEach(tx => {
            if (isWithinInterval(new Date(tx.date), { start: monthStart, end: monthEnd })) {
                let include = false;
                if (isOverallSummary) {
                    include = true;
                } else if (isPrimaryReport) {
                    const isCreditCard = tx.accountId ? creditCardIds.has(tx.accountId) : false;
                    include = tx.accountId === accountId || tx.accountId === 'cash-wallet' || tx.accountId === 'digital-wallet' || isCreditCard;
                } else {
                    include = tx.accountId === accountId;
                }

                if (include) {
                    const name = loan.personName;
                    if (loan.type === 'taken') {
                        if (tx.type === 'loan') {
                            report.totalLoanTaken += tx.amount;
                            report.loanTakenMap[name] = (report.loanTakenMap[name] || 0) + tx.amount;
                        } else { // repayment
                            report.totalRepaymentMade += tx.amount;
                            report.repaymentMadeMap[name] = (report.repaymentMadeMap[name] || 0) + tx.amount;
                        }
                    } else { // given
                        if (tx.type === 'loan') {
                            report.totalLoanGiven += tx.amount;
                            report.loanGivenMap[name] = (report.loanGivenMap[name] || 0) + tx.amount;
                        } else { // repayment
                            report.totalRepaymentReceived += tx.amount;
                            report.repaymentReceivedMap[name] = (report.repaymentReceivedMap[name] || 0) + tx.amount;
                        }
                    }
                }
            }
        });
    });

    const convertAndSort = (map: Record<string, number>): AggregatedLoanEntry[] => {
        return Object.entries(map)
            .map(([personName, amount]) => ({ personName, amount }))
            .sort((a, b) => b.amount - a.amount);
    };

    return {
        totalLoanTaken: report.totalLoanTaken,
        totalLoanGiven: report.totalLoanGiven,
        totalRepaymentMade: report.totalRepaymentMade,
        totalRepaymentReceived: report.totalRepaymentReceived,
        loanTakenTransactions: convertAndSort(report.loanTakenMap),
        loanGivenTransactions: convertAndSort(report.loanGivenMap),
        repaymentMadeTransactions: convertAndSort(report.repaymentMadeMap),
        repaymentReceivedTransactions: convertAndSort(report.repaymentReceivedMap),
    };
  }, [loans, monthStart, monthEnd, isOverallSummary, isPrimaryReport, accountId, creditCardIds]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = {
        totalIncome: 0,
        totalTransfersIn: 0,
        totalExpense: 0,
        totalTransfersOut: 0,
        incomeByCategory: {},
        expenseByCategory: {},
        regularExpenseByCategory: {},
        occasionalExpenseByCategory: {},
        totalRegularExpense: 0,
        totalOccasionalExpense: 0,
        incomeTransactions: [],
        expenseTransactions: [],
        transferInTransactions: [],
        transferOutTransactions: [],
        totalIncomeBudget: 0,
        totalExpenseBudget: 0,
        totalRegularBudget: 0,
        totalOccasionalBudget: 0,
    };
    
    const nonPrimaryBankAccountIds = new Set(accounts.filter(acc => !acc.isPrimary && acc.type !== 'card').map(acc => acc.id));

    monthlyTransactions.forEach(t => {
        const categoryName = t.category || "Uncategorized";
        const subCategoryName = t.subcategory || "Unspecified";
        const isWalletExpense = t.paymentMethod === 'cash' || t.paymentMethod === 'digital';
        
        let includeTransaction = false;
        if (isOverallSummary) {
          includeTransaction = true;
        } else if (isPrimaryReport) {
            const involvesPrimaryOrWallet = t.accountId === accountId || isWalletExpense || t.fromAccountId === accountId || t.toAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet';
            const involvesCreditCard = (t.accountId && creditCardIds.has(t.accountId)) || (t.fromAccountId && creditCardIds.has(t.fromAccountId)) || (t.toAccountId && creditCardIds.has(t.toAccountId));
            includeTransaction = involvesPrimaryOrWallet || involvesCreditCard;
        } else {
            includeTransaction = t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;
        }
        
        if (!includeTransaction) return;

        if (t.type === 'income') {
            data.totalIncome += t.amount;
            if (!data.incomeByCategory[categoryName]) {
                data.incomeByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
            }
            data.incomeByCategory[categoryName].total += t.amount;
            data.incomeByCategory[categoryName].subcategories[subCategoryName] = (data.incomeByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            data.incomeTransactions.push(t);
        } else if (t.type === 'expense') {
            let shouldProcessExpense = false;

            if (isOverallSummary) {
                shouldProcessExpense = true;
            } else if (isPrimaryReport) {
                shouldProcessExpense = t.accountId === accountId || isWalletExpense || (t.accountId ? creditCardIds.has(t.accountId) : false);
            } else { // Non-primary account view
                shouldProcessExpense = t.accountId === accountId;
            }
            
            if(shouldProcessExpense) {
                data.totalExpense += t.amount;
                if (!data.expenseByCategory[categoryName]) {
                    data.expenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                }
                data.expenseByCategory[categoryName].total += t.amount;
                data.expenseByCategory[categoryName].subcategories[subCategoryName] = (data.expenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
                
                const frequency = t.frequency || 'regular';
                if (frequency === 'occasional') {
                    data.totalOccasionalExpense += t.amount;
                    if (!data.occasionalExpenseByCategory[categoryName]) {
                        data.occasionalExpenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                    }
                    data.occasionalExpenseByCategory[categoryName].total += t.amount;
                    data.occasionalExpenseByCategory[categoryName].subcategories[subCategoryName] = (data.occasionalExpenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
                } else {
                    data.totalRegularExpense += t.amount;
                    if (!data.regularExpenseByCategory[categoryName]) {
                        data.regularExpenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                    }
                    data.regularExpenseByCategory[categoryName].total += t.amount;
                    data.regularExpenseByCategory[categoryName].subcategories[subCategoryName] = (data.regularExpenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
                }

                data.expenseTransactions.push(t);
            }
        } else if (t.type === 'transfer') {
             if (isPrimaryReport) {
                const isToPrimaryEcosystem = t.toAccountId === accountId || t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet' || (t.toAccountId ? creditCardIds.has(t.toAccountId) : false);
                const isFromPrimaryEcosystem = t.fromAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || (t.fromAccountId ? creditCardIds.has(t.fromAccountId) : false);

                if (t.fromAccountId && nonPrimaryBankAccountIds.has(t.fromAccountId) && isToPrimaryEcosystem) {
                    data.totalTransfersIn += t.amount;
                    data.transferInTransactions.push(t);
                }
                if (t.toAccountId && nonPrimaryBankAccountIds.has(t.toAccountId) && isFromPrimaryEcosystem) {
                    data.totalTransfersOut += t.amount;
                    data.transferOutTransactions.push(t);
                }
            } else if (!isOverallSummary) {
                if (t.toAccountId === accountId) {
                    data.totalTransfersIn += t.amount;
                    data.transferInTransactions.push(t);
                }
                if (t.fromAccountId === accountId) {
                    data.totalTransfersOut += t.amount;
                    data.transferOutTransactions.push(t);
                }
            }
        }
    });

    categories.forEach(cat => {
        const regularBudget = cat.subcategories
          .filter(sub => sub.frequency === 'monthly')
          .reduce((sum, sub) => sum + (sub.amount || 0), 0);

        const occasionalBudget = cat.subcategories
          .filter(sub => 
            sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName)
          )
          .reduce((sum, sub) => sum + (sub.amount || 0), 0);

        const categoryBudget = regularBudget + occasionalBudget;

        if (cat.type === 'expense' || cat.type === 'bank-expense') {
            if (data.expenseByCategory[cat.name]) {
                data.expenseByCategory[cat.name].budget = categoryBudget;
            } else if (categoryBudget > 0) {
                data.expenseByCategory[cat.name] = { total: 0, budget: categoryBudget, subcategories: {} };
            }
            data.totalExpenseBudget += categoryBudget;

            if (data.regularExpenseByCategory[cat.name]) {
                data.regularExpenseByCategory[cat.name].budget = regularBudget;
            } else if (regularBudget > 0) {
                data.regularExpenseByCategory[cat.name] = { total: 0, budget: regularBudget, subcategories: {} };
            }
            data.totalRegularBudget += regularBudget;

            if (data.occasionalExpenseByCategory[cat.name]) {
                data.occasionalExpenseByCategory[cat.name].budget = occasionalBudget;
            } else if (occasionalBudget > 0) {
                data.occasionalExpenseByCategory[cat.name] = { total: 0, budget: occasionalBudget, subcategories: {} };
            }
            data.totalOccasionalBudget += occasionalBudget;

        } else if (cat.type === 'income') {
            if (data.incomeByCategory[cat.name]) {
                data.incomeByCategory[cat.name].budget = categoryBudget;
            } else if (categoryBudget > 0) {
                data.incomeByCategory[cat.name] = { total: 0, budget: categoryBudget, subcategories: {} };
            }
            data.totalIncomeBudget += categoryBudget;
        }
    });


    return data;
  }, [monthlyTransactions, isOverallSummary, accountId, isPrimaryReport, categories, accounts, currentMonthName, creditCardIds]);

  const handleCategoryClick = (categoryName: string, type: 'income' | 'expense' | 'regular' | 'occasional') => {
    let categoryData;
    if (type === 'income') categoryData = monthlyReport.incomeByCategory[categoryName];
    else if (type === 'expense') categoryData = monthlyReport.expenseByCategory[categoryName];
    else if (type === 'regular') categoryData = monthlyReport.regularExpenseByCategory[categoryName];
    else if (type === 'occasional') categoryData = monthlyReport.occasionalExpenseByCategory[categoryName];
      
    if (categoryData) {
      setSelectedCategoryDetail({
        name: categoryName,
        total: categoryData.total,
        subcategories: categoryData.subcategories,
      });
      setIsDetailDialogOpen(true);
    }
  };
  
  const grandTotalInflow = monthlyReport.totalIncome + monthlyReport.totalTransfersIn + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyReport.totalTransfersOut + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade;
  const netBalance = grandTotalInflow - grandTotalOutflow;
  const hasTransactions = monthlyTransactions.length > 0;

  return (
    <>
    <div className="space-y-6">
      {!hasTransactions ? (
         <Card>
            <CardContent className="pt-6">
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <BookText className="h-10 w-10 mb-2"/>
                    <p>No transactions found for {format(currentDate, "MMMM yyyy")}.</p>
                </div>
            </CardContent>
        </Card>
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
                            <p className="text-xs text-muted-foreground">
                                Income, transfers in, loans taken, repayments received.
                            </p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Income:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyReport.totalIncome)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Transfers In:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyReport.totalTransfersIn)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Loans Taken:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Repayments Rcvd:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span>
                                </div>
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
                            <p className="text-xs text-muted-foreground">
                                Expenses, transfers out, loans given, repayments made.
                            </p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Expenses:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyReport.totalExpense)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Transfers Out:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyReport.totalTransfersOut)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Loans Given:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Repayments Made:</span>
                                    <span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span>
                                </div>
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
                            <div className={cn("text-2xl font-bold", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>
                                {formatCurrency(netBalance)}
                            </div>
                             <p className="text-xs text-muted-foreground">
                                Total Inflow - Total Outflow
                            </p>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Grand Inflow:</span>
                                    <span className="font-semibold text-green-600">{formatCurrency(grandTotalInflow)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Grand Outflow:</span>
                                    <span className="font-semibold text-red-600">{formatCurrency(grandTotalOutflow)}</span>
                                </div>
                            </CollapsibleContent>
                        </CardContent>
                    </Card>
                </CollapsibleTrigger>
            </Collapsible>
        </div>

        <FinancialAdvice 
          totalIncome={grandTotalInflow}
          totalExpense={grandTotalOutflow}
          expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))}
        />
        
        <div className="grid gap-6 md:grid-cols-2">
            <Card className="h-fit">
                <CardHeader>
                    <CardTitle>Income Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                {isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(monthlyReport.incomeByCategory).length > 0 ? (
                                Object.entries(monthlyReport.incomeByCategory).map(([category, { total, budget }]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'income')} className="cursor-pointer">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={isPrimaryReport ? 3 : 2} className="text-center text-muted-foreground">No income this month.</TableCell>
                                </TableRow>
                            )}
                            {monthlyReport.totalTransfersIn > 0 && (
                                 <TableRow onClick={() => setIsTransferDialogOpen(true)} className="cursor-pointer">
                                    <TableCell>
                                        <p className="font-medium">Transfers In</p>
                                        <p className="text-xs text-muted-foreground">({monthlyReport.transferInTransactions.length} transaction{monthlyReport.transferInTransactions.length === 1 ? '' : 's'})</p>
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyReport.totalTransfersIn)}</TableCell>
                                    {isPrimaryReport && <TableCell />}
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableHead>Total Income</TableHead>
                                <TableHead className="text-right">{formatCurrency(monthlyReport.totalIncome + monthlyReport.totalTransfersIn)}</TableHead>
                                {isPrimaryReport && <TableHead />}
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
                 {isPrimaryReport && (
                    <CardFooter className="flex-col items-start gap-2 pt-4">
                      <div className="w-full">
                        <Separator />
                        <div className="w-full flex justify-between font-bold text-base text-blue-600 mt-2">
                            <span>Total Income Budget</span>
                            <span className="font-mono">{formatCurrency(monthlyReport.totalIncomeBudget)}</span>
                        </div>
                      </div>
                    </CardFooter>
                )}
            </Card>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Regular Expense Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    {isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.keys(monthlyReport.regularExpenseByCategory).length > 0 ? (
                                    Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (
                                        <TableRow key={category} onClick={() => handleCategoryClick(category, 'regular')} className="cursor-pointer">
                                            <TableCell className="font-medium">{category}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                            {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isPrimaryReport ? 3 : 2} className="text-center text-muted-foreground">No regular expenses.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 pt-4">
                        <div className="w-full">
                            <Separator />
                            <div className="w-full flex justify-between font-bold text-sm mt-2">
                                <span>Subtotal Regular</span>
                                <span className="font-mono">{formatCurrency(monthlyReport.totalRegularExpense)}</span>
                            </div>
                            {isPrimaryReport && (
                                <div className="w-full flex justify-between font-bold text-sm text-blue-600 mt-1">
                                    <span>Budget</span>
                                    <span className="font-mono">{formatCurrency(monthlyReport.totalRegularBudget)}</span>
                                </div>
                            )}
                        </div>
                    </CardFooter>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Occasional Expense Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    {isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.keys(monthlyReport.occasionalExpenseByCategory).length > 0 ? (
                                    Object.entries(monthlyReport.occasionalExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (
                                        <TableRow key={category} onClick={() => handleCategoryClick(category, 'occasional')} className="cursor-pointer">
                                            <TableCell className="font-medium">{category}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                            {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={isPrimaryReport ? 3 : 2} className="text-center text-muted-foreground">No occasional expenses.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2 pt-4">
                        <div className="w-full">
                            <Separator />
                            <div className="w-full flex justify-between font-bold text-sm mt-2">
                                <span>Subtotal Occasional</span>
                                <span className="font-mono">{formatCurrency(monthlyReport.totalOccasionalExpense)}</span>
                            </div>
                            {isPrimaryReport && (
                                <div className="w-full flex justify-between font-bold text-sm text-blue-600 mt-1">
                                    <span>Budget</span>
                                    <span className="font-mono">{formatCurrency(monthlyReport.totalOccasionalBudget)}</span>
                                </div>
                            )}
                        </div>
                    </CardFooter>
                </Card>

                <Card className="bg-muted/30">
                    <CardContent className="p-4">
                        <div className="w-full flex justify-between font-bold text-base">
                            <span>Grand Total Expenses</span>
                            <span className="font-mono">{formatCurrency(monthlyReport.totalExpense)}</span>
                        </div>
                        {isPrimaryReport && (
                            <div className="w-full flex justify-between font-bold text-sm text-blue-600 mt-1">
                                <span>Grand Total Budget</span>
                                <span className="font-mono">{formatCurrency(monthlyReport.totalExpenseBudget)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>

         <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader><CardTitle>Loan Details (Taken)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.loanTakenTransactions.length > 0 ? (
                                monthlyLoanReport.loanTakenTransactions.map(tx => (
                                    <TableRow key={tx.personName}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loans taken this month.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Loans Taken</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableHead></TableRow></TableFooter>
                    </Table>
                    <Separator className="my-4"/>
                    <Table>
                        <TableHeader><TableRow><TableHead>Repayments To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.repaymentMadeTransactions.length > 0 ? (
                                monthlyLoanReport.repaymentMadeTransactions.map(tx => (
                                    <TableRow key={tx.personName}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No repayments made this month.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Repayments Made</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableHead></TableRow></TableFooter>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Loan Details (Given)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.loanGivenTransactions.length > 0 ? (
                                monthlyLoanReport.loanGivenTransactions.map(tx => (
                                    <TableRow key={tx.personName}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No loans given this month.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Loans Given</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableHead></TableRow></TableFooter>
                    </Table>
                    <Separator className="my-4"/>
                    <Table>
                        <TableHeader><TableRow><TableHead>Repayments From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.repaymentReceivedTransactions.length > 0 ? (
                                monthlyLoanReport.repaymentReceivedTransactions.map(tx => (
                                    <TableRow key={tx.personName}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No repayments received this month.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Repayments Received</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableHead></TableRow></TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </>
     )}
    </div>
     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
            <DialogTitle>{selectedCategoryDetail?.name} - Sub-category Breakdown</DialogTitle>
            <DialogDescription>
                Details of your activity in this category for {format(currentDate, "MMMM yyyy")}.
            </DialogDescription>
            </DialogHeader>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Sub-category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {selectedCategoryDetail && Object.keys(selectedCategoryDetail.subcategories).length > 0 ? (
                        Object.entries(selectedCategoryDetail.subcategories)
                        .sort(([,a],[,b]) => b - a)
                        .map(([name, amount]) => (
                        <TableRow key={name}>
                            <TableCell>{name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        </TableRow>
                    ))) : (
                        <TableRow>
                            <TableCell colSpan={2} className="text-center text-muted-foreground">No sub-category data for this period.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableHead>Total</TableHead>
                        <TableHead className="text-right">{formatCurrency(selectedCategoryDetail?.total || 0)}</TableHead>
                    </TableRow>
                </TableFooter>
            </Table>
             <DialogFooterComponent>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooterComponent>
        </DialogContent>
    </Dialog>
    <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
                <DialogTitle>Transfers Details</DialogTitle>
                <DialogDescription>
                    A list of all transfers for this account for {format(currentDate, "MMMM yyyy")}.
                </DialogDescription>
            </DialogHeader>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {monthlyReport.transferInTransactions.map(t => (
                        <TableRow key={t.id}>
                            <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{t.description} (In)</TableCell>
                            <TableCell className="text-right text-green-600">{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                    ))}
                    {monthlyReport.transferOutTransactions.map(t => (
                        <TableRow key={t.id}>
                            <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{t.description} (Out)</TableCell>
                            <TableCell className="text-right text-red-600">-{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableHead>Net Transfer</TableHead>
                        <TableHead colSpan={2} className="text-right">{formatCurrency(monthlyReport.totalTransfersIn - monthlyReport.totalTransfersOut)}</TableHead>
                    </TableRow>
                </TableFooter>
            </Table>
            <DialogFooterComponent>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooterComponent>
        </DialogContent>
    </Dialog>
    </>
  );
}
