
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction, Category, SubCategory } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee, AlertTriangle, Sparkles } from "lucide-react";
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
  DialogDescription as DialogDescriptionComponent,
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
  totalExpense: number;
  incomeByCategory: CategoryBreakdown;
  expenseByCategory: CategoryBreakdown;
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
};

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};


export function ReportView({ transactions, categories }: { transactions: Transaction[], categories: Category[] }) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);
  const { currentDate } = useReportDate();
  const [specialExpenseThreshold, setSpecialExpenseThreshold] = useState(2000);

  const monthlyReport = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    const monthlyTransactions = transactions.filter(t => isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }));

    const data: ReportData = {
        totalIncome: 0,
        totalExpense: 0,
        incomeByCategory: {},
        expenseByCategory: {},
        incomeTransactions: [],
        expenseTransactions: [],
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
            data.totalExpense += t.amount;
            if (!data.expenseByCategory[categoryName]) {
                data.expenseByCategory[categoryName] = { total: 0, subcategories: {} };
            }
            data.expenseByCategory[categoryName].total += t.amount;
            data.expenseByCategory[categoryName].subcategories[subCategoryName] = (data.expenseByCategory[categoryName].subcategories[subCategoryName] || 0) + t.amount;
            data.expenseTransactions.push(t);
        }
    });
    
    return data;
  }, [transactions, currentDate]);

  const specialExpenses = useMemo(() => {
    const expenseCategories = categories.filter(c => c.type === 'expense');
    
    // Create a map for quick subcategory lookup
    const subCategoryMap: { [key: string]: { [key: string]: SubCategory } } = {};
    expenseCategories.forEach(cat => {
      subCategoryMap[cat.id] = {};
      cat.subcategories.forEach(sub => {
        subCategoryMap[cat.id][sub.name] = sub;
      });
    });

    return monthlyReport.expenseTransactions.filter(t => {
      if (t.amount > specialExpenseThreshold && t.categoryId && t.subcategory) {
        const sub = subCategoryMap[t.categoryId]?.[t.subcategory];
        return sub?.frequency === 'occasional';
      }
      return false;
    });
  }, [monthlyReport.expenseTransactions, categories, specialExpenseThreshold]);


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

  const netSavings = monthlyReport.totalIncome - monthlyReport.totalExpense;
  const hasTransactions = monthlyReport.incomeTransactions.length > 0 || monthlyReport.expenseTransactions.length > 0;

  return (
    <>
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2">
            <Label htmlFor="special-expense-threshold" className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Special Expense Threshold</span>
            </Label>
            <Input
              id="special-expense-threshold"
              type="number"
              value={specialExpenseThreshold}
              onChange={(e) => setSpecialExpenseThreshold(Number(e.target.value))}
              className="hide-number-arrows"
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
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(monthlyReport.totalIncome)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(monthlyReport.totalExpense)}</div>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Net Savings</CardTitle>
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
              totalIncome={monthlyReport.totalIncome}
              totalExpense={monthlyReport.totalExpense}
              expenseByCategory={Object.fromEntries(Object.entries(monthlyReport.expenseByCategory).map(([k, v]) => [k, v.total]))}
            />
             <Card className="lg:col-span-2">
                 <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
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
        
        {specialExpenses.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="text-primary"/>
                        <span>Special Expenses Summary</span>
                    </CardTitle>
                    <CardDescription>
                        A summary of occasional expenses over {formatCurrency(specialExpenseThreshold)}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {specialExpenses.map(expense => (
                                <TableRow key={expense.id}>
                                    <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                                    <TableCell className="font-medium">{expense.description}</TableCell>
                                    <TableCell>{expense.category} / {expense.subcategory}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(expense.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableHead colSpan={3}>Total Special Expenses</TableHead>
                                <TableHead className="text-right">
                                    {formatCurrency(specialExpenses.reduce((acc, t) => acc + t.amount, 0))}
                                </TableHead>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        )}

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
                            {Object.entries(monthlyReport.incomeByCategory).map(([category, { total }]) => (
                                <TableRow key={category} onClick={() => handleCategoryClick(category, 'income')} className="cursor-pointer">
                                    <TableCell className="font-medium">{category}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableHead>Total Income</TableHead>
                                <TableHead className="text-right">{formatCurrency(monthlyReport.totalIncome)}</TableHead>
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
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(monthlyReport.expenseByCategory).sort(([,a],[,b])=> b.total - a.total).map(([category, {total}]) => (
                                <TableRow key={category} onClick={() => handleCategoryClick(category, 'expense')} className="cursor-pointer">
                                    <TableCell className="font-medium">{category}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableHead>Total Expenses</TableHead>
                                <TableHead className="text-right">{formatCurrency(monthlyReport.totalExpense)}</TableHead>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </div>
      </>
     )}
    </div>
     <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>{selectedCategoryDetail?.name} - Sub-category Breakdown</DialogTitle>
            <DialogDescriptionComponent>
                Details of your activity in this category for {format(currentDate, "MMMM yyyy")}.
            </DialogDescriptionComponent>
            </DialogHeader>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Sub-category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {selectedCategoryDetail && Object.entries(selectedCategoryDetail.subcategories)
                        .sort(([,a],[,b]) => b - a)
                        .map(([name, amount]) => (
                        <TableRow key={name}>
                            <TableCell>{name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                        </TableRow>
                    ))}
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
    </>
  );
}
