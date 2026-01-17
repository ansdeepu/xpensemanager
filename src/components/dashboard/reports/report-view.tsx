"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, SubCategory, Account, Loan, LoanTransaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, AlertTriangle } from "lucide-react";
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
import { useReportDate } from "@/context/report-date-context";
import { FinancialAdvice } from "./financial-advice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

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
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  transferInTransactions: Transaction[];
  transferOutTransactions: Transaction[];
  totalIncomeBudget: number;
  totalExpenseBudget: number;
};

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};


export function ReportView({ transactions, categories, accounts, loans, isOverallSummary, accountId, isPrimaryReport }: { transactions: Transaction[], categories: Category[], accounts: Account[], loans: Loan[], isOverallSummary: boolean, accountId?: string, isPrimaryReport?: boolean }) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);
  const { currentDate } = useReportDate();
  const [specialExpenseThreshold, setSpecialExpenseThreshold] = useState(2000);
  
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);
  const currentMonthName = useMemo(() => format(currentDate, "MMM"), [currentDate]);

  const monthlyTransactions = useMemo(() => 
    transactions.filter(t => isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd })),
    [transactions, monthStart, monthEnd]
  );
  
  const subCategoryMap = useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const map: { [key: string]: { [key: string]: SubCategory } } = {};
    expenseCategories.forEach(cat => {
      map[cat.id] = {};
      cat.subcategories.forEach(sub => {
        map[cat.id][sub.name] = sub;
      });
    });
    return map;
  }, [categories]);

  const specialExpenses = useMemo(() => {
    return monthlyTransactions.filter(t => {
      if (t.type === 'expense' && t.amount > specialExpenseThreshold && t.categoryId && t.subcategory) {
        const sub = subCategoryMap[t.categoryId]?.[t.subcategory];
        return sub?.frequency === 'occasional';
      }
      return false;
    });
  }, [monthlyTransactions, subCategoryMap, specialExpenseThreshold]);

  const specialExpenseIds = useMemo(() => new Set(specialExpenses.map(e => e.id)), [specialExpenses]);
  const totalSpecialExpense = useMemo(() => specialExpenses.reduce((acc, t) => acc + t.amount, 0), [specialExpenses]);

  const monthlyLoanReport = useMemo(() => {
    const report = {
        totalLoanTaken: 0,
        totalLoanGiven: 0,
        totalRepaymentMade: 0,
        totalRepaymentReceived: 0,
        loanTakenTransactions: [] as (LoanTransaction & { personName: string })[],
        loanGivenTransactions: [] as (LoanTransaction & { personName: string })[],
        repaymentMadeTransactions: [] as (LoanTransaction & { personName: string })[],
        repaymentReceivedTransactions: [] as (LoanTransaction & { personName: string })[],
    };

    if (!loans) return report;

    loans.forEach(loan => {
        (loan.transactions || []).forEach(tx => {
            if (isWithinInterval(new Date(tx.date), { start: monthStart, end: monthEnd })) {
                let include = false;
                if (isOverallSummary) {
                    include = true;
                } else if (isPrimaryReport) {
                    include = tx.accountId === accountId || tx.accountId === 'cash-wallet' || tx.accountId === 'digital-wallet';
                } else {
                    include = tx.accountId === accountId;
                }

                if (include) {
                    if (loan.type === 'taken') {
                        if (tx.type === 'loan') {
                            report.totalLoanTaken += tx.amount;
                            report.loanTakenTransactions.push({ ...tx, personName: loan.personName });
                        } else { // repayment
                            report.totalRepaymentMade += tx.amount;
                            report.repaymentMadeTransactions.push({ ...tx, personName: loan.personName });
                        }
                    } else { // given
                        if (tx.type === 'loan') {
                            report.totalLoanGiven += tx.amount;
                            report.loanGivenTransactions.push({ ...tx, personName: loan.personName });
                        } else { // repayment
                            report.totalRepaymentReceived += tx.amount;
                            report.repaymentReceivedTransactions.push({ ...tx, personName: loan.personName });
                        }
                    }
                }
            }
        });
    });

    return report;
  }, [loans, monthStart, monthEnd, isOverallSummary, isPrimaryReport, accountId]);

  const monthlyReport = useMemo(() => {
    const data: ReportData = {
        totalIncome: 0,
        totalTransfersIn: 0,
        totalExpense: 0,
        totalTransfersOut: 0,
        incomeByCategory: {},
        expenseByCategory: {},
        incomeTransactions: [],
        expenseTransactions: [],
        transferInTransactions: [],
        transferOutTransactions: [],
        totalIncomeBudget: 0,
        totalExpenseBudget: 0,
    };
    
    const nonPrimaryBankAccountIds = new Set(accounts.filter(acc => !acc.isPrimary).map(acc => acc.id));

    monthlyTransactions.forEach(t => {
        const categoryName = t.category || "Uncategorized";
        const subCategoryName = t.subcategory || "Unspecified";
        const isWalletExpense = t.paymentMethod === 'cash' || t.paymentMethod === 'digital';
        
        let includeTransaction = false;
        if (isOverallSummary) {
          includeTransaction = true;
        } else if (isPrimaryReport) {
            includeTransaction = t.accountId === accountId || isWalletExpense || t.fromAccountId === accountId || t.toAccountId === accountId || t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet';
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
                shouldProcessExpense = t.accountId === accountId || isWalletExpense;
            } else { // Non-primary account view
                shouldProcessExpense = t.accountId === accountId;
            }
            
            if(shouldProcessExpense) {
              if (!specialExpenseIds.has(t.id)) {
                  data.totalExpense += t.amount;
                  if (!data.expenseByCategory[categoryName]) {
                      data.expenseByCategory[categoryName] = { total: 0, budget: 0, subcategories: {} };
                  }
                  data.expenseByCategory[categoryName].total += t.amount;
                  data.expenseByCategory[categoryName].subcategories[subCategoryName] = (data.expenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
              }
              data.expenseTransactions.push(t);
            }
        } else if (t.type === 'transfer') {
             if (isPrimaryReport) {
                const isToPrimaryEcosystem = t.toAccountId === accountId || t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
                if (t.fromAccountId && nonPrimaryBankAccountIds.has(t.fromAccountId) && isToPrimaryEcosystem) {
                    data.totalTransfersIn += t.amount;
                    data.transferInTransactions.push(t);
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
        const categoryBudget = cat.subcategories
          .filter(sub => 
            sub.frequency === 'monthly' || 
            (sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName))
          )
          .reduce((sum, sub) => sum + (sub.amount || 0), 0);

        if (cat.type === 'expense' || cat.type === 'bank-expense') {
            if (data.expenseByCategory[cat.name]) {
                data.expenseByCategory[cat.name].budget = categoryBudget;
            } else if (categoryBudget > 0) {
                data.expenseByCategory[cat.name] = { total: 0, budget: categoryBudget, subcategories: {} };
            }
            data.totalExpenseBudget += categoryBudget;
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
  }, [monthlyTransactions, specialExpenseIds, isOverallSummary, accountId, isPrimaryReport, categories, accounts, currentMonthName]);

  const handleCategoryClick = (categoryName: string, type: 'income' | 'expense') => {
    const categoryData = type === 'income' 
      ? monthlyReport.incomeByCategory[categoryName] 
      : monthlyReport.expenseByCategory[categoryName];
      
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
  const grandTotalOutflow = monthlyReport.totalExpense + (isPrimaryReport ? totalSpecialExpense : 0) + (!isOverallSummary && !isPrimaryReport ? monthlyReport.totalTransfersOut : 0) + monthlyLoanReport.totalLoanGiven + monthlyLoanReport.totalRepaymentMade;
  const netBalance = grandTotalInflow - grandTotalOutflow;
  const hasTransactions = monthlyTransactions.length > 0;

  return (
    <>
    <div className="space-y-6">
       <div className="flex justify-end">
        <div className="flex items-center gap-2">
           <Label htmlFor="special-expense-threshold" className="text-sm font-bold text-red-600 flex items-center gap-2 flex-shrink-0">
             <AlertTriangle className="h-4 w-4" />
             <span>Special Expense Threshold</span>
           </Label>
           <Input
            id="special-expense-threshold"
            type="number"
            value={specialExpenseThreshold}
            onChange={(e) => setSpecialExpenseThreshold(Number(e.target.value))}
            className="hide-number-arrows w-32"
            placeholder="e.g. 2000"
          />
        </div>
      </div>
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
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Inflow</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalInflow)}</div>
                    <p className="text-xs text-muted-foreground">
                        Income, transfers in, loans taken, repayments received.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Outflow</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalOutflow)}</div>
                    <p className="text-xs text-muted-foreground">
                        Expenses, transfers out, loans given, repayments made.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                        {formatCurrency(netBalance)}
                    </div>
                     <p className="text-xs text-muted-foreground">
                        Total Inflow - Total Outflow
                    </p>
                </CardContent>
            </Card>
        </div>

        <FinancialAdvice 
          totalIncome={grandTotalInflow}
          totalExpense={grandTotalOutflow}
          expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))}
        />
        
        <div className="grid gap-6 md:grid-cols-2">
            <Card>
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
                      <div>
                        <Separator />
                        <div className="w-full flex justify-between font-bold text-base text-blue-600 mt-2">
                            <span>Total Income Budget</span>
                            <span className="font-mono">{formatCurrency(monthlyReport.totalIncomeBudget)}</span>
                        </div>
                      </div>
                    </CardFooter>
                )}
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Expense Details</CardTitle>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Regular Expenses</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                {isPrimaryReport && <TableHead className="text-right">Budget</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {Object.keys(monthlyReport.expenseByCategory).length > 0 ? (
                                Object.entries(monthlyReport.expenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total, budget}]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'expense')} className="cursor-pointer">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                        {isPrimaryReport && <TableCell className="text-right">{budget > 0 ? formatCurrency(budget) : '-'}</TableCell>}
                                    </TableRow>
                                ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={isPrimaryReport ? 3 : 2} className="text-center text-muted-foreground">No regular expenses this month.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {isPrimaryReport && specialExpenses.length > 0 && (
                        <>
                            <Separator className="my-4" />
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="font-bold text-red-600">Special Expenses (Occasional &gt; {formatCurrency(specialExpenseThreshold)})</TableHead>
                                        <TableHead className="text-right font-bold text-red-600">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {specialExpenses.map(expense => (
                                        <TableRow key={expense.id}>
                                            <TableCell>
                                                <p className="font-medium">{expense.description}</p>
                                                <p className="text-xs text-muted-foreground">{expense.category} / {expense.subcategory}</p>
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </>
                    )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 pt-4">
                    <div>
                        <Separator />
                        <div className="w-full flex justify-between text-sm text-muted-foreground mt-2">
                            <span>Regular Expenses Total</span>
                            <span className="font-mono">{formatCurrency(monthlyReport.totalExpense)}</span>
                        </div>
                        {isPrimaryReport && specialExpenses.length > 0 && (
                            <div className="w-full flex justify-between text-sm text-muted-foreground">
                                <span>Special Expenses Total</span>
                                <span className="font-mono">{formatCurrency(totalSpecialExpense)}</span>
                            </div>
                        )}
                        <div className="w-full flex justify-between font-bold text-base mt-2">
                            <span>Grand Total Expenses</span>
                            <span className="font-mono">{formatCurrency(grandTotalExpense)}</span>
                        </div>
                        {isPrimaryReport && (
                            <div className="w-full flex justify-between font-bold text-base text-blue-600 mt-2">
                                <span>Total Expense Budget</span>
                                <span className="font-mono">{formatCurrency(monthlyReport.totalExpenseBudget)}</span>
                            </div>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </div>
         <div className="grid gap-6 md:grid-cols-2">
            <Card>
                <CardHeader><CardTitle>Loan Details (Taken)</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.loanTakenTransactions.map(tx => (
                                <TableRow key={tx.id}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Loans Taken</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanTaken)}</TableHead></TableRow></TableFooter>
                    </Table>
                    <Separator className="my-4"/>
                    <Table>
                        <TableHeader><TableRow><TableHead>Repayments To</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.repaymentMadeTransactions.map(tx => (
                                <TableRow key={tx.id}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                            ))}
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
                            {monthlyLoanReport.loanGivenTransactions.map(tx => (
                                <TableRow key={tx.id}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                        <TableFooter><TableRow><TableHead>Total Loans Given</TableHead><TableHead className="text-right">{formatCurrency(monthlyLoanReport.totalLoanGiven)}</TableHead></TableRow></TableFooter>
                    </Table>
                    <Separator className="my-4"/>
                    <Table>
                        <TableHeader><TableRow><TableHead>Repayments From</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {monthlyLoanReport.repaymentReceivedTransactions.map(tx => (
                                <TableRow key={tx.id}><TableCell>{tx.personName}</TableCell><TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell></TableRow>
                            ))}
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
