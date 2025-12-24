
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, SubCategory } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
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
  [key: string]: { total: number; subcategories: { [key: string]: number } } 
};

type ReportData = {
  totalIncome: number;
  totalTransfersIn: number;
  totalExpense: number; // Will be regular expenses
  totalTransfersOut: number;
  incomeByCategory: CategoryBreakdown;
  expenseByCategory: CategoryBreakdown; // Regular expenses by category
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
  transferInTransactions: Transaction[];
  transferOutTransactions: Transaction[];
};

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};


export function ReportView({ transactions, categories, isOverallSummary, accountId }: { transactions: Transaction[], categories: Category[], isOverallSummary: boolean, accountId?: string }) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);
  const { currentDate } = useReportDate();
  const [specialExpenseThreshold, setSpecialExpenseThreshold] = useState(2000);
  
  const monthStart = useMemo(() => startOfMonth(currentDate), [currentDate]);
  const monthEnd = useMemo(() => endOfMonth(currentDate), [currentDate]);

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
    };

    monthlyTransactions.forEach(t => {
        const categoryName = t.category || "Uncategorized";
        const subCategoryName = t.subcategory || "Unspecified";

        if (t.type === 'income') {
            data.totalIncome += t.amount;
            if (!data.incomeByCategory[categoryName]) {
                data.incomeByCategory[categoryName] = { total: 0, subcategories: {} };
            }
            data.incomeByCategory[categoryName].total += t.amount;
            data.incomeByCategory[categoryName].subcategories[subCategoryName] = (data.incomeByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            data.incomeTransactions.push(t);
        } else if (t.type === 'expense') {
             if (isOverallSummary || (t.paymentMethod !== 'cash' && t.paymentMethod !== 'digital')) {
                if (!specialExpenseIds.has(t.id)) {
                    data.totalExpense += t.amount;
                    if (!data.expenseByCategory[categoryName]) {
                        data.expenseByCategory[categoryName] = { total: 0, subcategories: {} };
                    }
                    data.expenseByCategory[categoryName].total += t.amount;
                    data.expenseByCategory[categoryName].subcategories[subCategoryName] = (data.expenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
                }
                data.expenseTransactions.push(t);
            }
        } else if (t.type === 'transfer' && !isOverallSummary) {
            if (t.toAccountId === accountId) {
                data.totalTransfersIn += t.amount;
                data.transferInTransactions.push(t);
            }
            if (t.fromAccountId === accountId) {
                data.totalTransfersOut += t.amount;
                data.transferOutTransactions.push(t);
            }
        }
    });
    
    return data;
  }, [monthlyTransactions, specialExpenseIds, isOverallSummary, accountId]);

  const expenseChartData = useMemo(() => {
    return Object.entries(monthlyReport.expenseByCategory)
      .map(([name, { total }]) => ({ name, value: total }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyReport.expenseByCategory]);

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
  
  const grandTotalIncome = monthlyReport.totalIncome + monthlyReport.totalTransfersIn;
  const grandTotalExpense = monthlyReport.totalExpense + totalSpecialExpense + monthlyReport.totalTransfersOut;
  const netSavings = grandTotalIncome - grandTotalExpense;
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
                    <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalIncome)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(grandTotalExpense)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${netSavings >= 0 ? 'text-foreground' : 'text-red-600'}`}>
                        {formatCurrency(netSavings)}
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
            <FinancialAdvice 
              totalIncome={grandTotalIncome}
              totalExpense={grandTotalExpense}
              expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))}
            />
             <Card className="lg:col-span-2">
                 <CardHeader>
                    <CardTitle>Regular Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{
                      value: { label: "Amount" },
                    }} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                              data={expenseChartData}
                              layout="vertical"
                              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} interval={0} width={80} />
                              <XAxis type="number" tickFormatter={(value) => `${Number(value) / 1000}k`} />
                              <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} barSize={20} />
                          </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
        
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.keys(monthlyReport.incomeByCategory).length > 0 ? (
                                Object.entries(monthlyReport.incomeByCategory).map(([category, { total }]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'income')} className="cursor-pointer">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">No income this month.</TableCell>
                                </TableRow>
                            )}
                            {monthlyReport.totalTransfersIn > 0 && !isOverallSummary && (
                                <TableRow>
                                    <TableCell className="font-medium">Transfers In</TableCell>
                                    <TableCell className="text-right">{formatCurrency(monthlyReport.totalTransfersIn)}</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableHead>Total Income</TableHead>
                                <TableHead className="text-right">{formatCurrency(grandTotalIncome)}</TableHead>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
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
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {Object.keys(monthlyReport.expenseByCategory).length > 0 ? (
                                Object.entries(monthlyReport.expenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total}]) => (
                                    <TableRow key={category} onClick={() => handleCategoryClick(category, 'expense')} className="cursor-pointer">
                                        <TableCell className="font-medium">{category}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                    </TableRow>
                                ))
                             ) : (
                                <TableRow>
                                    <TableCell colSpan={2} className="text-center text-muted-foreground">No regular expenses this month.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    {specialExpenses.length > 0 && (
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
                     {monthlyReport.totalTransfersOut > 0 && !isOverallSummary && (
                        <>
                            <Separator className="my-4" />
                            <Table>
                                <TableBody>
                                    <TableRow onClick={() => setIsTransferDialogOpen(true)} className="cursor-pointer">
                                        <TableCell>
                                            <p className="font-medium">Transfers Out</p>
                                            <p className="text-xs text-muted-foreground">({monthlyReport.transferOutTransactions.length} transaction{monthlyReport.transferOutTransactions.length === 1 ? '' : 's'})</p>
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(monthlyReport.totalTransfersOut)}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </>
                    )}
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 pt-4">
                    <Separator />
                     <div className="w-full flex justify-between text-sm text-muted-foreground">
                        <span>Regular Expenses Total</span>
                        <span className="font-mono">{formatCurrency(monthlyReport.totalExpense)}</span>
                    </div>
                     {specialExpenses.length > 0 && (
                        <div className="w-full flex justify-between text-sm text-muted-foreground">
                            <span>Special Expenses Total</span>
                            <span className="font-mono">{formatCurrency(totalSpecialExpense)}</span>
                        </div>
                    )}
                     {monthlyReport.totalTransfersOut > 0 && !isOverallSummary && (
                        <div className="w-full flex justify-between text-sm text-muted-foreground">
                            <span>Transfers Out Total</span>
                            <span className="font-mono">{formatCurrency(monthlyReport.totalTransfersOut)}</span>
                        </div>
                    )}
                    <div className="w-full flex justify-between font-bold text-base">
                        <span>Grand Total Expenses</span>
                        <span className="font-mono">{formatCurrency(grandTotalExpense)}</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
      </>
     )}
    </div>
     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
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
             <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Transfers Out Details</DialogTitle>
                <DialogDescription>
                    A list of all transfers out from this account for {format(currentDate, "MMMM yyyy")}.
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
                    {monthlyReport.transferOutTransactions.map(t => (
                        <TableRow key={t.id}>
                            <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{t.description}</TableCell>
                            <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableHead>Total</TableHead>
                        <TableHead colSpan={2} className="text-right">{formatCurrency(monthlyReport.totalTransfersOut)}</TableHead>
                    </TableRow>
                </TableFooter>
            </Table>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Close</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
