
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { Account, Category, Transaction } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, BookText } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

type ReportData = {
  income: {
    categories: {
      [key: string]: {
        name: string;
        total: number;
        subcategories: {
          [key: string]: { name: string; total: number };
        };
      };
    };
    total: number;
  };
  expense: {
    categories: {
      [key: string]: {
        name: string;
        total: number;
        subcategories: {
          [key: string]: { name: string; total: number };
        };
      };
    };
    total: number;
  };
};

function ReportTable({ title, data }: { title: string, data: ReportData['income'] | ReportData['expense'] }) {
    const categories = Object.values(data.categories).sort((a,b) => b.total - a.total);

    if (data.total === 0) {
        return (
            <div className="pt-4">
                <p className="text-sm text-muted-foreground">No {title.toLowerCase()} for this period.</p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Category / Sub-category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {categories.map(cat => (
                    <React.Fragment key={cat.name}>
                        <TableRow className="bg-muted/50">
                            <TableCell className="font-semibold">{cat.name}</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(cat.total)}</TableCell>
                        </TableRow>
                        {Object.values(cat.subcategories).sort((a,b) => b.total - a.total).map(sub => (
                             <TableRow key={sub.name}>
                                <TableCell className="pl-8">{sub.name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(sub.total)}</TableCell>
                            </TableRow>
                        ))}
                    </React.Fragment>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableHead>Total {title}</TableHead>
                    <TableHead className="text-right">{formatCurrency(data.total)}</TableHead>
                </TableRow>
            </TableFooter>
        </Table>
    )
}


export default function ReportsPage() {
  const [user, userLoading] = useAuthState(auth);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
        if(dataLoading) setDataLoading(false);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);
  
  const monthlyReport = useMemo(() => {
    const report: { [key: string]: ReportData } = {};
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    const allAccounts = [
        ...accounts,
        { id: 'cash-wallet', name: 'Cash Wallet' },
        { id: 'digital-wallet', name: 'Digital Wallet' }
    ];

    allAccounts.forEach(acc => {
        report[acc.id] = {
            income: { categories: {}, total: 0 },
            expense: { categories: {}, total: 0 }
        };
    });

    const monthlyTransactions = transactions.filter(t => isWithinInterval(new Date(t.date), { start: monthStart, end: monthEnd }));

    monthlyTransactions.forEach(t => {
      let targetAccountId: string | null = null;
      
      if (t.type === 'expense') {
        if (t.paymentMethod === 'cash') targetAccountId = 'cash-wallet';
        else if (t.paymentMethod === 'digital') targetAccountId = 'digital-wallet';
        else if (t.accountId) targetAccountId = t.accountId;
      } else if (t.type === 'income' && t.accountId) {
        targetAccountId = t.accountId;
      }

      if (targetAccountId && report[targetAccountId]) {
        const reportSection = report[targetAccountId][t.type];
        if (!reportSection) return;

        reportSection.total += t.amount;
        
        const categoryName = t.category || "Uncategorized";
        if (!reportSection.categories[categoryName]) {
            reportSection.categories[categoryName] = { name: categoryName, total: 0, subcategories: {} };
        }
        reportSection.categories[categoryName].total += t.amount;

        const subCategoryName = t.subcategory || "Unspecified";
        if (!reportSection.categories[categoryName].subcategories[subCategoryName]) {
            reportSection.categories[categoryName].subcategories[subCategoryName] = { name: subCategoryName, total: 0 };
        }
        reportSection.categories[categoryName].subcategories[subCategoryName].total += t.amount;
      }
    });

    return report;
  }, [accounts, transactions, currentDate]);

  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));
  
  if (userLoading || dataLoading) {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-48 w-full" />
                </CardContent>
            </Card>
        </div>
    )
  }

  const allAccountIds = [
      ...accounts.map(a => a.id), 
      'cash-wallet', 
      'digital-wallet'
    ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>Monthly Report</CardTitle>
                <CardDescription>
                A detailed breakdown of income and expenses for each account.
                </CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-semibold w-36 text-center">{format(currentDate, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <Accordion type="single" collapsible className="w-full" defaultValue={accounts.find(a => a.isPrimary)?.id || 'cash-wallet'}>
                {accounts.map(account => (
                     <AccordionItem value={account.id} key={account.id}>
                        <AccordionTrigger>
                            <div className="flex justify-between w-full pr-4">
                                <span>{account.name}</span>
                                <div className="flex gap-4">
                                    <span className="text-green-600">{formatCurrency(monthlyReport[account.id]?.income.total || 0)}</span>
                                    <span className="text-red-600">{formatCurrency(monthlyReport[account.id]?.expense.total || 0)}</span>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                           <ReportTable title="Income" data={monthlyReport[account.id].income} />
                           <ReportTable title="Expenses" data={monthlyReport[account.id].expense} />
                        </AccordionContent>
                     </AccordionItem>
                ))}
                 <AccordionItem value="cash-wallet">
                    <AccordionTrigger>
                         <div className="flex justify-between w-full pr-4">
                            <span>Cash Wallet</span>
                            <span className="text-red-600">{formatCurrency(monthlyReport['cash-wallet']?.expense.total || 0)}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ReportTable title="Expenses" data={monthlyReport['cash-wallet'].expense} />
                    </AccordionContent>
                 </AccordionItem>
                 <AccordionItem value="digital-wallet">
                    <AccordionTrigger>
                         <div className="flex justify-between w-full pr-4">
                            <span>Digital Wallet</span>
                            <span className="text-red-600">{formatCurrency(monthlyReport['digital-wallet']?.expense.total || 0)}</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <ReportTable title="Expenses" data={monthlyReport['digital-wallet'].expense} />
                    </AccordionContent>
                 </AccordionItem>
            </Accordion>
            {allAccountIds.every(id => (monthlyReport[id]?.income.total === 0 && monthlyReport[id]?.expense.total === 0)) && (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40 border-2 border-dashed rounded-lg mt-6">
                    <BookText className="h-10 w-10 mb-2"/>
                    <p>No transactions found for {format(currentDate, "MMMM yyyy")}.</p>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
