
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, Account, Loan, LoanTransaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, ChevronDown, ChevronUp, Landmark, HandCoins, ArrowRightLeft } from "lucide-react";
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
  DialogDescription,
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
import { useReportDate } from "@/context/report-date-context";
import { FinancialAdvice } from "./financial-advice";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const postBankCategoryNames = [
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

  const previousBalance = useMemo(() => {
    if (isOverallSummary || !accountId) return 0;
    let bal = 0;
    const isCard = creditCardIds.has(accountId);
    transactions.forEach(t => {
      const d = new Date(t.date);
      if (!isValid(d) || !isBefore(d, monthStart)) return;
      if (t.type === 'income' && t.accountId === accountId) bal += t.amount;
      else if (t.type === 'expense' && t.accountId === accountId) {
        if (isCard) bal += t.amount; else bal -= t.amount;
      } else if (t.type === 'transfer') {
        if (t.fromAccountId === accountId) {
          if (isCard) bal += t.amount; else bal -= t.amount;
        }
        if (t.toAccountId === accountId) {
          if (isCard) bal -= t.amount; else bal += t.amount;
        }
      }
    });
    return bal;
  }, [transactions, accountId, monthStart, isOverallSummary, creditCardIds]);

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
        totalLoanTaken: 0, totalLoanGiven: 0, totalRepaymentMade: 0, totalRepaymentReceived: 0,
        totalSBILoan: 0, totalSBIRepayment: 0, totalSBICashback: 0, totalSBICharges: 0,
        loanTakenMap: {} as Record<string, number>, loanGivenMap: {} as Record<string, number>,
        repaymentMadeMap: {} as Record<string, number>, repaymentReceivedMap: {} as Record<string, number>,
        sbiLoanTransactions: [] as { name: string, amount: number }[], sbiRepaymentTransactions: [] as { name: string, amount: number }[],
        sbiCashbackTransactions: [] as { name: string, amount: number }[], sbiChargesTransactions: [] as { name: string, amount: number }[],
    };

    let totalTransferOut = 0;
    const transferOutDetails: { name: string, amount: number }[] = [];
    const isInEcosystem = (accId?: string) => Boolean(accId === primaryAccount?.id || accId === 'cash-wallet' || accId === 'digital-wallet' || (accId && creditCardIds.has(accId)));

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
        const isSBIAccount = t.accountId === sbiCardId || t.fromAccountId === sbiCardId || t.toAccountId === sbiCardId;
        if (isSBIAccount) {
            const isSBICashback = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId === 'cashback-source';
            const isSBIRepayment = t.type === 'transfer' && t.toAccountId === sbiCardId && t.fromAccountId !== 'cashback-source' && !creditCardIds.has(t.fromAccountId!);
            const isSBICharge = t.type === 'expense' && t.accountId === sbiCardId && (t.category?.toLowerCase().includes('charge') || t.category?.toLowerCase().includes('bank charge'));
            const isSBILoanSpending = (t.type === 'expense' && t.accountId === sbiCardId && !isSBICharge) || (t.type === 'transfer' && t.fromAccountId === sbiCardId);

            let includeInSbi = false;
            if (isOverallSummary) includeInSbi = true;
            else if (isPrimaryReport) includeInSbi = true;
            else includeInSbi = Boolean(t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId);

            if (includeInSbi) {
                if (isSBILoanSpending) { report.totalSBILoan += t.amount; report.sbiLoanTransactions.push({ name: t.description || 'Card Usage', amount: t.amount }); }
                else if (isSBIRepayment) { report.totalSBIRepayment += t.amount; report.sbiRepaymentTransactions.push({ name: t.description || 'Repayment', amount: t.amount }); }
                else if (isSBICashback) { report.totalSBICashback += t.amount; report.sbiCashbackTransactions.push({ name: t.description || 'Cashback', amount: t.amount }); }
                else if (isSBICharge) { report.totalSBICharges += t.amount; report.sbiChargesTransactions.push({ name: t.description || 'Bank Charge', amount: t.amount }); }
            }
        }
        if (t.type === 'transfer') {
            if (isInEcosystem(t.fromAccountId) && !isInEcosystem(t.toAccountId) && !t.loanTransactionId) {
                const targetAccount = accounts.find(a => a.id === t.toAccountId);
                if (targetAccount) { totalTransferOut += t.amount; transferOutDetails.push({ name: targetAccount.name, amount: t.amount }); }
            }
        }
    });

    const convertAndSort = (map: Record<string, number>): AggregatedEntry[] => Object.entries(map).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
    return {
        monthlyLoanReport: { ...report, loanTakenTransactions: convertAndSort(report.loanTakenMap), loanGivenTransactions: convertAndSort(report.loanGivenMap), repaymentMadeTransactions: convertAndSort(report.repaymentMadeMap), repaymentReceivedTransactions: convertAndSort(report.repaymentReceivedMap) },
        monthlyTransferSummary: { total: totalTransferOut, details: transferOutDetails }
    };
  }, [loans, monthStart, monthEnd, isOverallSummary, isPrimaryReport, accountId, creditCardIds, monthlyTransactions, sbiCardId, accounts, primaryAccount]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = {
        totalIncome: 0, totalExpense: 0,
        incomeByCategory: {}, expenseByCategory: {}, regularExpenseByCategory: {}, occasionalExpenseByCategory: {},
        totalRegularExpense: 0, totalOccasionalExpense: 0, totalIncomeBudget: 0, totalExpenseBudget: 0, totalRegularBudget: 0, totalOccasionalBudget: 0,
    };
    const bankExpenseCategoryNames = new Set(categories.filter(c => c.type === 'bank-expense').map(c => c.name));
    monthlyTransactions.forEach(t => {
        const categoryName = t.category || "Uncategorized";
        const subCategoryName = t.subcategory || "Unspecified";
        let include = false;
        if (isOverallSummary) include = true;
        else if (isPrimaryReport) {
            const isWallet = Boolean(t.paymentMethod === 'cash' || t.paymentMethod === 'digital');
            const involvesPrimaryOrWallet = Boolean(t.accountId === accountId || isWallet || t.fromAccountId === accountId || t.toAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet');
            const involvesCC = Boolean((t.accountId && creditCardIds.has(t.accountId)) || (t.fromAccountId && creditCardIds.has(t.fromAccountId)) || (t.toAccountId && creditCardIds.has(t.toAccountId)));
            include = involvesPrimaryOrWallet || involvesCC;
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
        const totalB = regularBudget + occasionalBudget;
        if (cat.type === 'expense') {
            if (totalB > 0 || cat.subcategories.length > 0) {
                if (!data.regularExpenseByCategory[cat.name]) data.regularExpenseByCategory[cat.name] = { total: 0, budget: 0, subcategories: {} };
                data.regularExpenseByCategory[cat.name].budget = totalB;
                data.totalRegularBudget += totalB;
            }
            data.totalExpenseBudget += totalB;
        } else if (cat.type === 'income') {
            if (data.incomeByCategory[cat.name]) data.incomeByCategory[cat.name].budget = totalB;
            data.totalIncomeBudget += totalB;
        }
    });
    return data;
  }, [monthlyTransactions, isOverallSummary, accountId, isPrimaryReport, categories, currentMonthName, creditCardIds]);

  const grandTotalInflow = monthlyReport.totalIncome + monthlyLoanReport.totalLoanTaken + monthlyLoanReport.totalRepaymentReceived + monthlyLoanReport.totalSBILoan + monthlyLoanReport.totalSBICashback;
  const sbiOut = monthlyLoanReport.totalSBIRepayment + monthlyLoanReport.totalSBICharges + monthlyLoanReport.totalSBICashback;
  const grandTotalOutflow = monthlyReport.totalExpense + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade + sbiOut + monthlyTransferSummary.total;
  const netBalance = grandTotalInflow - grandTotalOutflow;

  const currentInflow = monthlyTransactions.reduce((sum, t) => (t.accountId === accountId && t.type === 'income') || (t.toAccountId === accountId && t.type === 'transfer') ? sum + t.amount : sum, 0);
  const currentOutflow = monthlyTransactions.reduce((sum, t) => (t.accountId === accountId && t.type === 'expense') || (t.fromAccountId === accountId && t.type === 'transfer') ? sum + t.amount : sum, 0);
  const closingBalance = previousBalance + currentInflow - currentOutflow;

  if (!isOverallSummary && !isPrimaryReport && accountId) {
    const accountName = accounts.find(a => a.id === accountId)?.name || 'Account';
    const isPostBank = accountName.toLowerCase().includes('post bank');
    const incomeDetails: Record<string, number> = {};
    const expenseDetails: Record<string, number> = {};
    transactions.forEach(t => {
        if (t.accountId === accountId) {
            if (t.type === 'income') incomeDetails[t.category || 'Other'] = (incomeDetails[t.category || 'Other'] || 0) + t.amount;
            if (t.type === 'expense') expenseDetails[t.category || 'Other'] = (expenseDetails[t.category || 'Other'] || 0) + t.amount;
        }
    });
    const loanDetails = loans.map(l => {
        const txs = (l.transactions || []).filter(tx => tx.accountId === accountId);
        if (txs.length === 0 || l.type === 'taken') return null;
        const given = txs.filter(tx => tx.type === 'loan').reduce((s, tx) => s + tx.amount, 0);
        const repay = txs.filter(tx => tx.type === 'repayment').reduce((s, tx) => s + tx.amount, 0);
        return { id: l.id, name: l.personName, given, repayment: repay, balance: given - repay, txs: txs.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()) };
    }).filter(Boolean);
    const transferDetails = transactions.filter(t => t.type === 'transfer' && (t.fromAccountId === accountId || t.toAccountId === accountId)).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const postBankAccordionData = isPostBank ? postBankCategoryNames.map(cat => {
        const catTxs = transactions.filter(t => (t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId) && (t.subcategory === cat || t.category === cat || (t.description && t.description.toLowerCase().includes(cat.toLowerCase())))).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let run = 0, cred = 0, deb = 0;
        const txsWithBal = catTxs.map(t => {
            let c = 0, d = 0, e = 0;
            if (t.type === 'income' && t.accountId === accountId) { c = t.amount; e = t.amount; }
            else if (t.type === 'expense' && t.accountId === accountId) { d = t.amount; e = -t.amount; }
            else if (t.type === 'transfer') {
                if (t.toAccountId === accountId) { c = t.amount; e = t.amount; }
                if (t.fromAccountId === accountId) { d = t.amount; e = -t.amount; }
            }
            cred += c; deb += d; run += e;
            return { ...t, credit: c || null, debit: d || null, balance: run };
        });
        return { name: cat, credit: cred, debit: deb, balance: cred - deb, transactions: txsWithBal.reverse() };
    }) : [];

    const handleCategoryClickLocal = (n: string, a: number, sub: Record<string, number>) => { setSelectedDetail({ name: n, total: a, subcategories: sub }); setIsDetailDialogOpen(true); };

    return (
      <div className="space-y-6">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><Landmark className="h-5 w-5" />{accountName} PASSBOOK STATEMENT</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground uppercase">Previous Balance</p><p className="text-xl font-bold">{formatCurrency(previousBalance)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Current Month In</p><p className="text-xl font-bold text-green-600">+{formatCurrency(currentInflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase">Current Month Out</p><p className="text-xl font-bold text-red-600">-{formatCurrency(currentOutflow)}</p></div>
              <div><p className="text-xs text-muted-foreground uppercase font-semibold">Closing Balance</p><p className={cn("text-xl font-bold", closingBalance >= 0 ? "text-primary" : "text-red-600")}>{formatCurrency(closingBalance)}</p></div>
            </div>
          </CardContent>
        </Card>
        {isPostBank ? (
            <Card>
                <CardHeader><CardTitle>Post Bank Fund Categories (All Time)</CardTitle></CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {postBankAccordionData.map((cat, idx) => (
                            <AccordionItem key={idx} value={`pb-${idx}`}>
                                <AccordionTrigger className="hover:no-underline"><div className="flex justify-between w-full pr-4"><span>{cat.name}</span><span className={cn("font-bold", cat.balance >= 0 ? "text-green-600" : "text-red-600")}>{formatCurrency(cat.balance)}</span></div></AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/30 rounded-lg">
                                        <div className="flex gap-4 mb-4 text-xs font-semibold"><span>Credits: <span className="text-green-600">{formatCurrency(cat.credit)}</span></span><span>Debits: <span className="text-red-600">{formatCurrency(cat.debit)}</span></span></div>
                                        <Table className="text-xs">
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                                            <TableBody>{cat.transactions.map((tx, i) => (<TableRow key={i}><TableCell>{format(new Date(tx.date), 'dd/MM/yy')}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right text-green-600">{tx.credit ? formatCurrency(tx.credit) : ''}</TableCell><TableCell className="text-right text-red-600">{tx.debit ? formatCurrency(tx.debit) : ''}</TableCell><TableCell className="text-right font-mono">{formatCurrency(tx.balance)}</TableCell></TableRow>))}</TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        ) : (
            <div className="grid gap-6 lg:grid-cols-2 items-start">
                <div className="space-y-6">
                    <Card><CardHeader><CardTitle>Income Details (All Time)</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{Object.entries(incomeDetails).sort(([,a],[,b]) => b - a).map(([cat, amt]) => (<TableRow key={cat} onClick={() => handleCategoryClickLocal(cat, amt, {})} className="cursor-pointer hover:bg-muted/50"><TableCell>{cat}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(amt)}</TableCell></TableRow>))}{Object.keys(incomeDetails).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">No income.</TableCell></TableRow>}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold">{formatCurrency(Object.values(incomeDetails).reduce((s,a)=>s+a,0))}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
                    <Card><CardHeader><CardTitle>Loan Details (All Time)</CardTitle></CardHeader><CardContent>{loanDetails.length > 0 ? <Accordion type="single" collapsible>{loanDetails.map(l => (<AccordionItem key={l!.id} value={l!.id}><AccordionTrigger className="py-2"><div className="flex justify-between w-full pr-4"><span>{l!.name}</span><Badge variant="outline">{formatCurrency(l!.balance)}</Badge></div></AccordionTrigger><AccordionContent><Table className="text-xs"><TableBody>{l!.txs.map(tx => (<TableRow key={tx.id}><TableCell>{format(parseISO(tx.date), 'dd/MM/yy')}</TableCell><TableCell className="text-right text-red-600">{tx.type === 'loan' ? formatCurrency(tx.amount) : ''}</TableCell><TableCell className="text-right text-green-600">{tx.type === 'repayment' ? formatCurrency(tx.amount) : ''}</TableCell></TableRow>))}</TableBody></Table></AccordionContent></AccordionItem>))}</Accordion> : <p className="text-center py-10 text-muted-foreground text-sm">No loans given.</p>}</CardContent></Card>
                </div>
                <div className="space-y-6">
                    <Card><CardHeader><CardTitle>Expense Details (All Time)</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{Object.entries(expenseDetails).sort(([,a],[,b]) => b - a).map(([cat, amt]) => (<TableRow key={cat} onClick={() => handleCategoryClickLocal(cat, amt, {})} className="cursor-pointer hover:bg-muted/50"><TableCell>{cat}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(amt)}</TableCell></TableRow>))}{Object.keys(expenseDetails).length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">No expenses.</TableCell></TableRow>}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold">{formatCurrency(Object.values(expenseDetails).reduce((s,a)=>s+a,0))}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
                    <Card><CardHeader><CardTitle>Transfer Details (All Time)</CardTitle></CardHeader><CardContent><ScrollArea className="h-[300px]"><Table>{transferDetails.map(t => { const out = t.fromAccountId === accountId; const other = accounts.find(a => a.id === (out ? t.toAccountId : t.fromAccountId))?.name || 'Other'; return <TableRow key={t.id}><TableCell className="text-xs">{format(new Date(t.date), 'dd/MM/yy')}</TableCell><TableCell className="text-xs">{out ? `➔ ${other}` : `← ${other}`}</TableCell><TableCell className={cn("text-right text-xs", out ? "text-red-600" : "text-green-600")}>{formatCurrency(t.amount)}</TableCell></TableRow> })}</Table></ScrollArea></CardContent></Card>
                </div>
            </div>
        )}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{selectedDetail?.name}</DialogTitle></DialogHeader><Table><TableBody>{selectedDetail && Object.keys(selectedDetail.subcategories).length > 0 ? Object.entries(selectedDetail.subcategories).map(([n,a])=>(<TableRow key={n}><TableCell>{n}</TableCell><TableCell className="text-right">{formatCurrency(a)}</TableCell></TableRow>)) : <TableRow><TableCell colSpan={2} className="text-center py-10 text-muted-foreground">Aggregated summary.</TableCell></TableRow>}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold">{formatCurrency(selectedDetail?.total || 0)}</TableHead></TableRow></TableFooter></Table><DialogFooterComponent><DialogClose asChild><Button variant="secondary">Close</Button></DialogClose></DialogFooterComponent></DialogContent></Dialog>
      </div>
    );
  }

  const handleMonthlyCategoryClick = (n: string, type: 'income' | 'expense' | 'regular' | 'occasional') => {
    let d;
    if (type === 'income') d = monthlyReport.incomeByCategory[n];
    else if (type === 'expense') d = monthlyReport.expenseByCategory[n];
    else if (type === 'regular') d = monthlyReport.regularExpenseByCategory[n];
    else if (type === 'occasional') d = monthlyReport.occasionalExpenseByCategory[n];
    if (d) { setSelectedDetail({ name: n, total: d.total, subcategories: d.subcategories }); setIsDetailDialogOpen(true); }
  };

  const handleMonthlyGenericClick = (t: string, d: AggregatedEntry[], total: number) => {
    const sub: Record<string, number> = {};
    d.forEach(x => { sub[x.name] = (sub[x.name] || 0) + x.amount; });
    setSelectedDetail({ name: t, total, subcategories: sub });
    setIsDetailDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {!monthlyTransactions.length ? (
         <Card><CardContent className="pt-6"><div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40"><BookText className="h-10 w-10 mb-2"/><p>No transactions found for {format(currentDate, "MMMM yyyy")}.</p></div></CardContent></Card>
      ) : (
      <>
        <div className="grid gap-6 md:grid-cols-3">
            <Collapsible open={isInflowOpen} onOpenChange={setIsInflowOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Inflow</CardTitle><div className="flex items-center gap-1"><TrendingUp className="h-4 w-4 text-muted-foreground" />{isInflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Income Categories:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalIncome)}</span></div><div className="flex justify-between text-xs"><span>Loan Taken:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</span></div><div className="flex justify-between text-xs"><span>Repayment received:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</span></div><div className="flex justify-between text-xs"><span>SBI Card Usage:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBILoan)}</span></div><div className="flex justify-between text-xs"><span>SBI Card Cashback:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalSBICashback)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
            <Collapsible open={isOutflowOpen} onOpenChange={setIsOutflowOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Outflow</CardTitle><div className="flex items-center gap-1"><TrendingDown className="h-4 w-4 text-muted-foreground" />{isOutflowOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Expenses:</span><span className="font-semibold">{formatCurrency(monthlyReport.totalExpense)}</span></div><div className="flex justify-between text-xs"><span>Loan Given:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</span></div><div className="flex justify-between text-xs"><span>Repayment of Loan Taken:</span><span className="font-semibold">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</span></div><div className="flex justify-between text-xs"><span>SBI Card Repay & Adj.:</span><span className="font-semibold">{formatCurrency(sbiOut)}</span></div><div className="flex justify-between text-xs"><span>Transfers:</span><span className="font-semibold">{formatCurrency(monthlyTransferSummary.total)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
            <Collapsible open={isNetOpen} onOpenChange={setIsNetOpen}><CollapsibleTrigger asChild><Card className="cursor-pointer hover:bg-muted/30 transition-colors"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Net Balance</CardTitle><div className="flex items-center gap-1"><IndianRupee className="h-4 w-4 text-muted-foreground" />{isNetOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}</div></CardHeader><CardContent><div className={cn("text-2xl font-bold", netBalance >= 0 ? 'text-foreground' : 'text-red-600')}>{formatCurrency(netBalance)}</div><CollapsibleContent className="mt-4 pt-4 border-t space-y-2"><div className="flex justify-between text-xs"><span>Inflow:</span><span className="font-semibold text-green-600">{formatCurrency(grandTotalInflow)}</span></div><div className="flex justify-between text-xs"><span>Outflow:</span><span className="font-semibold text-red-600">{formatCurrency(grandTotalOutflow)}</span></div></CollapsibleContent></CardContent></Card></CollapsibleTrigger></Collapsible>
        </div>

        <FinancialAdvice totalIncome={grandTotalInflow} totalExpense={grandTotalOutflow} expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))} />
        
        <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div className="space-y-6">
                <Card><CardHeader><CardTitle>Income Details</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead>{isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}</TableRow></TableHeader><TableBody>{Object.entries(monthlyReport.incomeByCategory).map(([cat, { total, budget }]) => (<TableRow key={cat} onClick={() => handleMonthlyCategoryClick(cat, 'income')} className="cursor-pointer hover:bg-muted/50 transition-colors"><TableCell className="font-medium">{cat}</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell>{isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}</TableRow>))}{monthlyLoanReport.totalLoanTaken > 0 && (<TableRow onClick={() => handleMonthlyGenericClick('Loan Taken', monthlyLoanReport.loanTakenTransactions, monthlyLoanReport.totalLoanTaken)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600"><TableCell>Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableCell>{isPrimaryReport && <TableCell className="text-right">-</TableCell>}</TableRow>)}{monthlyLoanReport.totalRepaymentReceived > 0 && (<TableRow onClick={() => handleMonthlyGenericClick('Repayment of Loan Given', monthlyLoanReport.repaymentReceivedTransactions, monthlyLoanReport.totalRepaymentReceived)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600"><TableCell>Repayment of Loan Given</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableCell>{isPrimaryReport && <TableCell className="text-right">-</TableCell>}</TableRow>)}{monthlyLoanReport.totalSBILoan > 0 && (<TableRow onClick={() => handleMonthlyGenericClick('SBI Credit Card Usage', monthlyLoanReport.sbiLoanTransactions, monthlyLoanReport.totalSBILoan)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600"><TableCell>SBI Credit Card Usage</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBILoan)}</TableCell>{isPrimaryReport && <TableCell className="text-right">-</TableCell>}</TableRow>)}{monthlyLoanReport.totalSBICashback > 0 && (<TableRow onClick={() => handleMonthlyGenericClick('SBI Credit Card Cashback', monthlyLoanReport.sbiCashbackTransactions, monthlyLoanReport.totalSBICashback)} className="cursor-pointer hover:bg-muted/50 font-medium text-green-600"><TableCell>SBI Credit Card Cashback</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalSBICashback)}</TableCell>{isPrimaryReport && <TableCell className="text-right">-</TableCell>}</TableRow>)}</TableBody><TableFooter><TableRow><TableHead>Total Inflow</TableHead><TableHead className="text-right font-mono">{formatCurrency(grandTotalInflow)}</TableHead>{isPrimaryReport && <TableHead />}</TableRow></TableFooter></Table></CardContent></Card>
                <Card><CardHeader><CardTitle>Loan Taken</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{monthlyLoanReport.loanTakenTransactions.length > 0 ? (monthlyLoanReport.loanTakenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No loans taken.</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
                <Card><CardHeader><CardTitle>Repayment of Loan Given</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>From Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{monthlyLoanReport.repaymentReceivedTransactions.length > 0 ? (monthlyLoanReport.repaymentReceivedTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-green-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No repayments received.</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentReceived)}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
            </div>
            <div className="space-y-6">
                <Card className="bg-card"><CardHeader><CardTitle className="text-lg">Expense Details</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Outflow Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody><TableRow onClick={() => handleMonthlyGenericClick('Regular Expenses', Object.entries(monthlyReport.regularExpenseByCategory).map(([name, v]) => ({ name, amount: v.total })), monthlyReport.totalRegularExpense)} className="cursor-pointer hover:bg-muted/50"><TableCell>Regular Expenses</TableCell><TableCell className="text-right">{formatCurrency(monthlyReport.totalRegularExpense)}</TableCell></TableRow><TableRow onClick={() => handleMonthlyGenericClick('Occasional Expenses', Object.entries(monthlyReport.occasionalExpenseByCategory).map(([name, v]) => ({ name, amount: v.total })), monthlyReport.totalOccasionalExpense)} className="cursor-pointer hover:bg-muted/50"><TableCell>Occasional Expenses</TableCell><TableCell className="text-right">{formatCurrency(monthlyReport.totalOccasionalExpense)}</TableCell></TableRow><TableRow onClick={() => handleMonthlyGenericClick('Loan Given', monthlyLoanReport.loanGivenTransactions, monthlyLoanReport.totalLoanGiven)} className="cursor-pointer hover:bg-muted/50"><TableCell>Loan Given</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableCell></TableRow><TableRow onClick={() => handleMonthlyGenericClick('Repayment of Loan Taken', monthlyLoanReport.repaymentMadeTransactions, monthlyLoanReport.totalRepaymentMade)} className="cursor-pointer hover:bg-muted/50"><TableCell>Repayment of Loan Taken</TableCell><TableCell className="text-right">{formatCurrency(monthlyLoanReport.totalRepaymentMade)}</TableCell></TableRow><TableRow onClick={() => handleMonthlyGenericClick('SBI CC Repay & Adj.', [...monthlyLoanReport.sbiRepaymentTransactions, ...monthlyLoanReport.sbiChargesTransactions, ...monthlyLoanReport.sbiCashbackTransactions], sbiOut)} className="cursor-pointer hover:bg-muted/50"><TableCell>SBI CC Repay & Adj.</TableCell><TableCell className="text-right">{formatCurrency(sbiOut)}</TableCell></TableRow><TableRow onClick={() => handleMonthlyGenericClick('Transfers', monthlyTransferSummary.details, monthlyTransferSummary.total)} className="cursor-pointer hover:bg-muted/50"><TableCell>Transfer</TableCell><TableCell className="text-right">{formatCurrency(monthlyTransferSummary.total)}</TableCell></TableRow></TableBody><TableFooter><TableRow><TableHead>Total Outflow</TableHead><TableHead className="text-right font-mono">{formatCurrency(grandTotalOutflow)}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
                <Card><CardHeader><CardTitle>Regular Expense Details</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead className="text-right">Amount</TableHead>{isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}</TableRow></TableHeader><TableBody>{Object.entries(monthlyReport.regularExpenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (<TableRow key={category} onClick={() => handleMonthlyCategoryClick(category, 'regular')} className="cursor-pointer hover:bg-muted/50"><TableCell className="font-medium">{category}</TableCell><TableCell className="text-right">{formatCurrency(total)}</TableCell>{isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}</TableRow>))}</TableBody></Table></CardContent></Card>
                <Card><CardHeader><CardTitle>Loan Given</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>To Person</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{monthlyLoanReport.loanGivenTransactions.length > 0 ? (monthlyLoanReport.loanGivenTransactions.map(tx => (<TableRow key={tx.name}><TableCell>{tx.name}</TableCell><TableCell className="text-right text-red-600">{formatCurrency(tx.amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground text-xs italic">No loans given.</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableHead></TableRow></TableFooter></Table></CardContent></Card>
            </div>
        </div>
      </>
     )}
     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{selectedDetail?.name}</DialogTitle><DialogDescription>Breakdown for {format(currentDate, "MMMM yyyy")}.</DialogDescription></DialogHeader><div className="max-h-[50vh] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Detail</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{selectedDetail && Object.keys(selectedDetail.subcategories).length > 0 ? (Object.entries(selectedDetail.subcategories).sort(([,a],[,b]) => b - a).map(([name, amount]) => (<TableRow key={name}><TableCell>{name}</TableCell><TableCell className="text-right font-mono">{formatCurrency(amount)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">No additional breakdown.</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableHead>Total</TableHead><TableHead className="text-right font-bold font-mono">{formatCurrency(selectedDetail?.total || 0)}</TableHead></TableRow></TableFooter></Table></div><DialogFooterComponent><DialogClose asChild><Button variant="secondary">Close</Button></DialogClose></DialogFooterComponent></DialogContent></Dialog>
    </div>
  );
}
