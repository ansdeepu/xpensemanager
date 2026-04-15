
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp, Landmark, ArrowRightLeft } from "lucide-react";
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
import { PostCategoryAccordion } from "@/components/dashboard/post-bank/post-category-accordion";

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

type DetailViewData = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};

type AggregatedEntry = {
    name: string;
    amount: number;
};

// Specialized categories for Post Bank tab
const postBankCategories: Category[] = [
  { id: 'pb_cat_1', name: 'Diesel Collection', icon: 'fuel', subcategories: [], order: 0, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_2', name: 'Staff Club Accounts', icon: 'users', subcategories: [], order: 1, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_3', name: 'Ente Keralam Accounts', icon: 'map', subcategories: [], order: 2, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_4', name: 'Seminar Accounts', icon: 'presentation', subcategories: [], order: 3, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_5', name: 'Jayaram Treatment', icon: 'heart', subcategories: [], order: 4, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_6', name: 'SLR Retirement - Jan 2026', icon: 'calendar', subcategories: [], order: 5, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_15', name: 'Bank Charges', icon: 'landmark', subcategories: [], order: 6, type: 'bank-expense', userId: '' },
  { id: 'pb_cat_16', name: 'Deepa Car Accounts', icon: 'car', subcategories: [], order: 7, type: 'bank-expense', userId: '' },
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

  const accountInfo = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);
  const isPostBankTab = useMemo(() => accountInfo?.name.toLowerCase().includes('post bank'), [accountInfo]);

  // Previous Balance Calculation (Balance before current month start)
  const previousBalance = useMemo(() => {
    if (isOverallSummary) return 0; // Summaries don't have a singular opening balance
    
    let balance = 0;
    const pastTransactions = transactions.filter(t => isBefore(new Date(t.date), monthStart));
    const sortedPast = pastTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedPast.forEach(t => {
        const involvesPrimaryEcosystem = isPrimaryReport && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet');
        
        if (isPrimaryReport) {
            // Include primary bank account + wallets
            if (t.type === 'income' && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital')) balance += t.amount;
            else if (t.type === 'expense' && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital')) balance -= t.amount;
            else if (t.type === 'transfer') {
                const isFromEcosystem = t.fromAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
                const isToEcosystem = t.toAccountId === accountId || t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
                
                if (isFromEcosystem && !isToEcosystem) balance -= t.amount;
                else if (!isFromEcosystem && isToEcosystem) balance += t.amount;
            }
        } else {
            // Individual account specific
            if (t.type === 'income' && t.accountId === accountId) balance += t.amount;
            else if (t.type === 'expense' && t.accountId === accountId && t.paymentMethod === 'online') balance -= t.amount;
            else if (t.type === 'transfer') {
                if (t.fromAccountId === accountId) balance -= t.amount;
                if (t.toAccountId === accountId) balance += t.amount;
            }
        }
    });
    return balance;
  }, [transactions, monthStart, accountId, isPrimaryReport, isOverallSummary]);

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
        totalSBICashback: 0,
        totalSBICharges: 0,
        loanTakenMap: {} as Record<string, number>,
        loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>,
        repaymentReceivedMap: {} as Record<string, number>,
        sbiLoanTransactions: [] as { name: string, amount: number }[],
        sbiRepaymentTransactions: [] as { name: string, amount: number }[],
        sbiCashbackTransactions: [] as { name: string, amount: number }[],
        sbiChargesTransactions: [] as { name: string, amount: number }[],
    };

    let totalTransferOut = 0;
    const transferOutDetails: { name: string, amount: number }[] = [];
    
    const primaryAccount = accounts.find(a => a.isPrimary);
    const creditCardIds = new Set(accounts.filter(a => a.type === 'card').map(a => a.id));
    const sbiCardId = accounts.find(a => a.type === 'card' && a.name.toLowerCase().includes('sbi'))?.id;

    const isInEcosystem = (accId?: string) => 
        Boolean(accId === primaryAccount?.id || accId === 'cash-wallet' || accId === 'digital-wallet' || (accId && creditCardIds.has(accId)));

    loans.forEach(loan => {
        const name = loan.personName;
        if (name.toLowerCase().includes('sbi')) return;

        (loan.transactions || []).forEach(tx => {
            const d = new Date(tx.date);
            if (isValid(d) && isWithinInterval(d, { start: monthStart, end: monthEnd })) {
                let include = false;
                if (isOverallSummary) include = true;
                else if (isPrimaryReport) include = Boolean(tx.accountId === accountId || tx.accountId === 'cash-wallet' || tx.accountId === 'digital-wallet' || (tx.accountId && creditCardIds.has(tx.accountId)));
                else include = Boolean(tx.accountId === accountId);

                if (include) {
                    if (loan.type === 'taken') {
                        if (tx.type === 'loan') { 
                            report.totalLoanTaken += tx.amount; 
                            report.loanTakenMap[name] = (report.loanTakenMap[name] || 0) + tx.amount; 
                        } else { 
                            report.totalRepaymentMade += tx.amount; 
                            report.repaymentMadeMap[name] = (report.repaymentMadeMap[name] || 0) + tx.amount; 
                        }
                    } else {
                        if (tx.type === 'loan') { 
                            report.totalLoanGiven += tx.amount; 
                            report.loanGivenMap[name] = (report.loanGivenMap[name] || 0) + tx.amount; 
                        } else { 
                            report.totalRepaymentReceived += tx.amount; 
                            report.repaymentReceivedMap[name] = (report.repaymentReceivedMap[name] || 0) + tx.amount; 
                        }
                    }
                }
            }
        });
    });

    monthlyTransactions.forEach(t => {
        const isSBIAccount = t.accountId === sbiCardId || t.fromAccountId === sbiCardId || t.toAccountId === sbiCardId;
        const isSBICashback = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId === 'cashback-source';
        const isSBIRepayment = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId !== 'cashback-source' && !creditCardIds.has(t.fromAccountId!);
        const isSBICharge = t.type === 'expense' && t.accountId === sbiCardId && (t.category?.toLowerCase().includes('charge') || t.category?.toLowerCase().includes('bank charge'));
        
        const isSBILoanSpending = (t.type === 'expense' && t.accountId === sbiCardId && !isSBICharge) || (t.type === 'transfer' && t.fromAccountId === sbiCardId);

        let includeInSbi = false;
        if (isOverallSummary) includeInSbi = isSBIAccount;
        else if (isPrimaryReport) includeInSbi = isSBIAccount;
        else includeInSbi = Boolean(t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);

        if (includeInSbi) {
            if (isSBILoanSpending) { 
                report.totalSBILoan += t.amount; 
                report.sbiLoanTransactions.push({ name: t.description || 'Card Usage', amount: t.amount }); 
            } else if (isSBIRepayment) { 
                report.totalSBIRepayment += t.amount; 
                report.sbiRepaymentTransactions.push({ name: t.description || 'Repayment', amount: t.amount }); 
            } else if (isSBICashback) { 
                report.totalSBICashback += t.amount; 
                report.sbiCashbackTransactions.push({ name: t.description || 'Cashback', amount: t.amount }); 
            } else if (isSBICharge) {
                report.totalSBICharges += t.amount;
                report.sbiChargesTransactions.push({ name: t.description || 'Bank Charge', amount: t.amount });
            }
        }

        if (t.type === 'transfer') {
            if (isOverallSummary) {
                // For overall, transfers LEAVING the tracked ecosystem
                const isFromEcosystem = isInEcosystem(t.fromAccountId);
                const isToEcosystem = isInEcosystem(t.toAccountId);
                if (isFromEcosystem && !isToEcosystem && !t.loanTransactionId) {
                    const targetAccount = accounts.find(a => a.id === t.toAccountId);
                    if (targetAccount) {
                        totalTransferOut += t.amount;
                        transferOutDetails.push({ name: targetAccount.name, amount: t.amount });
                    }
                }
            } else {
                // For specific account, any transfer OUT
                if (t.fromAccountId === accountId && !t.loanTransactionId) {
                    const targetAccount = accounts.find(a => a.id === t.toAccountId) || { name: t.toAccountId?.replace('-', ' ') || 'Unknown' };
                    totalTransferOut += t.amount;
                    transferOutDetails.push({ name: targetAccount.name, amount: t.amount });
                }
            }
        }
    });

    const convertAndSort = (map: Record<string, number>): AggregatedEntry[] => 
        Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

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
  }, [loans, monthStart, monthEnd, isOverallSummary, isPrimaryReport, accountId, monthlyTransactions, accounts]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = {
        totalIncome: 0, totalExpense: 0,
        incomeByCategory: {}, expenseByCategory: {}, regularExpenseByCategory: {}, occasionalExpenseByCategory: {},
        totalRegularExpense: 0, totalOccasionalExpense: 0, totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0,
    };
    
    const bankExpenseCategoryNames = new Set(categories.filter(c => c.type === 'bank-expense').map(c => c.name));
    const creditCardIds = new Set(accounts.filter(a => a.type === 'card').map(a => a.id));

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
            if (bankExpenseCategoryNames.has(categoryName)) return;

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

        if (cat.type === 'expense') {
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
  }, [monthlyTransactions, isOverallSummary, accountId, isPrimaryReport, categories, currentMonthName, accounts]);

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

  const handleGenericDetailClick = (title: string, data: AggregatedEntry[], total: number) => {
    const subcategories: Record<string, number> = {};
    data.forEach(d => { subcategories[d.name] = (subcategories[d.name] || 0) + d.amount; });
    setSelectedDetail({ name: title, total, subcategories });
    setIsDetailDialogOpen(true);
  };
  
  const grandTotalInflow = monthlyReport.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan + monthlyLoanReport.totalSBICashback;
  
  const sbiNetRepaymentSummary = monthlyLoanReport.totalSBIRepayment + monthlyLoanReport.totalSBICharges + monthlyLoanReport.totalSBICashback;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + sbiNetRepaymentSummary + monthlyTransferSummary.total;
  
  const netBalance = grandTotalInflow - grandTotalOutflow;
  const closingBalance = previousBalance + netBalance;

  const postBankTransactionsForAccordion = useMemo(() => {
    if (!isPostBankTab) return [];
    return monthlyTransactions
        .filter(t => t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId)
        .map(t => ({ ...t, balance: 0 })); // Actual running balance is computed in PostCategoryAccordion
  }, [isPostBankTab, monthlyTransactions, accountId]);

  return (
    <div className="space-y-6">
      {!monthlyTransactions.length && isOverallSummary ? (
         <Card><CardContent className="pt-6"><div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40"><BookText className="h-10 w-10 mb-2"/><p>No transactions found for {format(currentDate, "MMMM yyyy")}.</p></div></CardContent></Card>
      ) : (
      <>
        {/* Account Summary Card (Only for specific accounts) */}
        {!isOverallSummary && (
            <Card className="bg-lime-50/50 dark:bg-lime-900/10 border-lime-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Landmark className="h-5 w-5 text-primary" />
                        Monthly Statement Summary: {accountInfo?.name}
                    </CardTitle>
                    <CardDescription>Reconciliation from previous month to current end.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Previous Balance</p>
                            <p className={cn("text-xl font-bold", previousBalance >= 0 ? "text-foreground" : "text-red-600")}>{formatCurrency(previousBalance)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Month Inflow (+)</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Month Outflow (-)</p>
                            <p className="text-xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Closing Balance</p>
                            <p className={cn("text-xl font-bold", closingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(closingBalance)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        )}

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
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span>Income Categories:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalIncome)}</span></div>
                                <div className="flex justify-between text-xs"><span>Loan Taken:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span></div>
                                <div className="flex justify-between text-xs"><span>Repayment received:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span></div>
                                <div className="flex justify-between text-xs"><span>SBI Card Loan:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBILoan)}</span></div>
                                <div className="flex justify-between text-xs"><span>SBI Card Cashback:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBICashback)}</span></div>
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
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span>Expenses:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalExpense)}</span></div>
                                <div className="flex justify-between text-xs"><span>Loan Given:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div>
                                <div className="flex justify-between text-xs"><span>Repayment made:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div>
                                <div className="flex justify-between text-xs"><span>SBI Card Repay & Adj.:</span><span className="font-semibold">{formatCurrency(sbiNetRepaymentSummary)}</span></div>
                                <div className="flex justify-between text-xs"><span>Transfers:</span><span className="font-semibold">{formatCurrency(monthlyTransferSummary.total)}</span></div>
                            </CollapsibleContent>
                        </CardContent>
                    </Card>
                </CollapsibleTrigger>
            </Collapsible>
            <Collapsible open={isNetOpen} onOpenChange={setIsNetOpen}>
                <CollapsibleTrigger asChild>
                    <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Month Net Change</CardTitle>
                            <div className="flex items-center gap-1">
                                <IndianRupee className="h-4 w-4 text-muted-foreground" />
                                {isNetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-bold", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>{formatCurrency(netBalance)}</div>
                            <CollapsibleContent className="mt-4 pt-4 border-t space-y-2">
                                <div className="flex justify-between text-xs"><span>Inflow:</span><span className="font-semibold text-green-600">{formatCurrency(grandTotalInflow)}</span></div>
                                <div className="flex justify-between text-xs"><span>Outflow:</span><span className="font-semibold text-red-600">{formatCurrency(grandTotalOutflow)}</span></div>
                            </CollapsibleContent>
                        </CardContent>
                    </Card>
                </CollapsibleTrigger>
            </Collapsible>
        </div>

        {isOverallSummary && <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))} />}
        
        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div className="space-y-6">
                <Card>
                    <CardHeader><CardTitle>Inflow Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Source</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    {isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(monthlyReport.incomeByCategory).map(([category, { total, budget }]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'income')} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                    </TableRow>
                                ))}
                                {monthlyLoanReport.totalLoanTaken > 0 && (
                                    <TableRow onClick={() => handleGenericDetailClick('Loan Taken', monthlyLoanReport.loanTakenTransactions, monthlyLoanReport.totalLoanTaken)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600">
                                        <TableCell>Loan Taken</TableCell>
                                        <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">-</TableCell>}
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalRepaymentReceived > 0 && (
                                    <TableRow onClick={() => handleGenericDetailClick('Repayment of Loan Given', monthlyLoanReport.repaymentReceivedTransactions, monthlyLoanReport.totalRepaymentReceived)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600">
                                        <TableCell>Repayment Received</TableCell>
                                        <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">-</TableCell>}
                                    </TableRow>
                                )}
                                {(monthlyLoanReport.totalSBILoan > 0 || isPrimaryReport || isOverallSummary) && (
                                    <TableRow onClick={() => handleGenericDetailClick('Credit Card Funding', monthlyLoanReport.sbiLoanTransactions, monthlyLoanReport.totalSBILoan)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600">
                                        <TableCell>SBI Card Usage (Loan)</TableCell>
                                        <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">-</TableCell>}
                                    </TableRow>
                                )}
                                {monthlyLoanReport.totalSBICashback > 0 && (
                                    <TableRow onClick={() => handleGenericDetailClick('SBI Credit Card Cashback', monthlyLoanReport.sbiCashbackTransactions, monthlyLoanReport.totalSBICashback)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600">
                                        <TableCell>SBI Card Cashback</TableCell>
                                        <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">-</TableCell>}
                                    </TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableHead>Total Inflow</TableHead>
                                    <TableHead className="text-right font-mono">{formatCurrency(grandTotalInflow)}</TableHead>
                                    {isPrimaryReport && <TableHead />}
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Inflow Detail Tables</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Loans Taken</h4>
                            <Table>
                                <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {monthlyLoanReport.loanTakenTransactions.length > 0 ? (
                                        monthlyLoanReport.loanTakenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                    ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No loans taken.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Repayments Received</h4>
                            <Table>
                                <TableHeader><TableRow><TableHead>From Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {monthlyLoanReport.repaymentReceivedTransactions.length > 0 ? (
                                        monthlyLoanReport.repaymentReceivedTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                    ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No repayments received.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="bg-card">
                    <CardHeader><CardTitle className="text-lg">Outflow Details</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Outflow Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                            <TableBody>
                                <TableRow onClick={() => handleGenericDetailClick('Regular Expenses', Object.entries(monthlyReport.regularExpenseByCategory).map(([name, v]) => ({ name, amount: v.total })), monthlyReport.totalRegularExpense)} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>Regular Expenses</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyReport.totalRegularExpense)}</TableCell>
                                </TableRow>
                                <TableRow onClick={() => handleGenericDetailClick('Occasional Expenses', Object.entries(monthlyReport.occasionalExpenseByCategory).map(([name, v]) => ({ name, amount: v.total })), monthlyReport.totalOccasionalExpense)} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>Occasional Expenses</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyReport.totalOccasionalExpense)}</TableCell>
                                </TableRow>
                                <TableRow onClick={() => handleGenericDetailClick('Loan Given', monthlyLoanReport.loanGivenTransactions, monthlyLoanReport.totalLoanGiven)} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>Loan Given</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell>
                                </TableRow>
                                <TableRow onClick={() => handleGenericDetailClick('Repayments Made', monthlyLoanReport.repaymentMadeTransactions, monthlyLoanReport.totalRepaymentMade)} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>Repayment Made</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell>
                                </TableRow>
                                <TableRow 
                                    onClick={() => handleGenericDetailClick('SBI Card Repayment & Adjustments', [...monthlyLoanReport.sbiRepaymentTransactions, ...monthlyLoanReport.sbiChargesTransactions, ...monthlyLoanReport.sbiCashbackTransactions], sbiNetRepaymentSummary)} 
                                    className="cursor-pointer hover:bg-muted/50"
                                >
                                    <TableCell>SBI Card Repay & Adj.</TableCell>
                                    <TableCell className="text-right">{formatCurrency(sbiNetRepaymentSummary)}</TableCell>
                                </TableRow>
                                <TableRow onClick={() => handleGenericDetailClick('External Transfers', monthlyTransferSummary.details, monthlyTransferSummary.total)} className="cursor-pointer hover:bg-muted/50">
                                    <TableCell>External Transfers</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyTransferSummary.total)}</TableCell>
                                </TableRow>
                            </TableBody>
                            <TableFooter><TableRow><TableHead>Total Outflow</TableHead><TableHead className="text-right font-mono">{formatCurrency(grandTotalOutflow)}</TableHead></TableRow></TableFooter>
                        </Table>
                    </CardContent>
                </Card>

                {isPostBankTab ? (
                    <PostCategoryAccordion
                        categories={postBankCategories}
                        transactions={postBankTransactionsForAccordion}
                        postBankAccountId={accountId}
                    />
                ) : (
                    <>
                        <Card>
                            <CardHeader><CardTitle>Regular Expense Details</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>{isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}</TableRow></TableHeader>
                                    <TableBody>
                                        {Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (
                                            <TableRow key={category} onClick={() => handleCategoryClick(category, 'regular')} className="cursor-pointer hover:bg-muted/50">
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
                                            <TableRow key={category} onClick={() => handleCategoryClick(category, 'occasional')} className="cursor-pointer hover:bg-muted/50">
                                                <TableCell className="font-medium">{category}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </>
                )}

                <Card>
                    <CardHeader><CardTitle>Outflow Detail Tables</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Loans Given</h4>
                            <Table>
                                <TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {monthlyLoanReport.loanGivenTransactions.length > 0 ? (
                                        monthlyLoanReport.loanGivenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                    ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No loans given.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Transfers to Other Banks</h4>
                            <Table>
                                <TableHeader><TableRow><TableHead>To Account</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {monthlyTransferSummary.details.length > 0 ? (
                                        monthlyTransferSummary.details.map((tx, i) => (<TableRow key={i}><TableCell>{tx.name}</TableCell><TableCell className="text-right font-mono">{formatCurrency(tx.amount)}</TableCell></TableRow>))
                                    ) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No external bank transfers.</TableCell></TableRow>)}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </>
     )}

     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-xl">
            <DialogHeader><DialogTitle>{selectedDetail?.name} - Detailed Breakdown</DialogTitle><DialogDescription>Breakdown for {format(currentDate, "MMMM yyyy")}.</DialogDescription></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                    <TableHeader><TableRow><TableHead>Detail</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                    <TableBody>{selectedDetail && Object.keys(selectedDetail.subcategories).length > 0 ? (Object.entries(selectedDetail.subcategories).sort(([,a],[,b]) => b - a).map(([name, amount]) => (<TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No additional breakdown available.</TableCell></TableRow>)}</TableBody>
                    <TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold font-mono">{formatCurrency(selectedDetail?.total || 0)}</TableHead></TableRow></TableFooter>
                </Table>
            </div>
             <DialogFooterComponent><DialogClose asChild><Button type="button" variant="secondary">Close</Button></DialogClose></DialogFooterComponent>
        </DialogContent>
    </Dialog>
    </div>
  );
}
