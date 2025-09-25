
"use client";

import React, { useState, useMemo } from "react";
import type { Transaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookText, TrendingUp, TrendingDown, IndianRupee } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { useReportDate } from "@/context/report-date-context";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type ReportData = {
  totalIncome: number;
  totalExpense: number;
  incomeByCategory: { [key: string]: number };
  expenseByCategory: { [key: string]: { total: number; subcategories: { [key: string]: number } } };
  incomeTransactions: Transaction[];
  expenseTransactions: Transaction[];
};

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};


export function ReportView({ transactions }: { transactions: Transaction[] }) {
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);
  const { currentDate } = useReportDate();

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
            data.incomeByCategory[categoryName] = (data.incomeByCategory[categoryName] || 0) + t.amount;
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

  const expenseChartData = useMemo(() => {
    return Object.entries(monthlyReport.expenseByCategory)
      .map(([name, { total }]) => ({ name, value: total }))
      .sort((a, b) => a.value - b.value);
  }, [monthlyReport.expenseByCategory]);

  const handleCategoryClick = (categoryName: string) => {
    const categoryData = monthlyReport.expenseByCategory[categoryName];
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
            <Card className="lg:col-span-2">
                 <CardHeader>
                    <CardTitle>Income vs Expenses</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{
                        income: { label: "Income", color: "hsl(var(--chart-2))" },
                        expense: { label: "Expense", color: "hsl(var(--chart-5))" },
                    }} className="h-[250px] w-full">
                        <BarChart
                            data={[{ name: 'Month', income: monthlyReport.totalIncome, expense: monthlyReport.totalExpense }]}
                            layout="vertical"
                            margin={{ left: 0, right: 20 }}
                            barSize={32}
                        >
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                            <Bar dataKey="income" fill="var(--color-income)" radius={5} />
                            <Bar dataKey="expense" fill="var(--color-expense)" radius={5} />
                        </BarChart>
                    </ChartContainer>
                     <div className="mt-4 space-y-2">
                        <div className="flex justify-between font-medium"><span>Income</span> <span className="text-green-600">{formatCurrency(monthlyReport.totalIncome)}</span></div>
                        <div className="flex justify-between font-medium"><span>Expense</span> <span className="text-red-600">{formatCurrency(monthlyReport.totalExpense)}</span></div>
                         {monthlyReport.totalIncome > 0 && <Progress value={(monthlyReport.totalExpense / monthlyReport.totalIncome) * 100} className="h-2" />}
                    </div>
                </CardContent>
            </Card>
             <Card className="lg:col-span-3">
                 <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={{
                      value: { label: "Amount" },
                    }} className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height={300}>
                          <BarChart
                              layout="vertical"
                              data={expenseChartData}
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tickFormatter={(value) => formatCurrency(value as number)} />
                              <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                              <ChartTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltipContent />} />
                              <Bar dataKey="value" fill="hsl(var(--chart-1))" barSize={20} />
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
                            {Object.entries(monthlyReport.incomeByCategory).map(([category, amount]) => (
                                <TableRow key={category}>
                                    <TableCell className="font-medium">{category}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
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
                                <TableRow key={category} onClick={() => handleCategoryClick(category)} className="cursor-pointer">
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
            <DialogDescription>
                Details of your spending in this category for {format(currentDate, "MMMM yyyy")}.
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
