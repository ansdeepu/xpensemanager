"use client";

import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format, parseISO, isValid } from "date-fns";
import type { Category, Transaction } from "@/lib/data";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

function CategoryAccordionItem({
    category,
    transactions,
    postBankAccountId,
}: {
    category: Category;
    transactions: Transaction[];
    postBankAccountId: string | undefined;
}) {
    const categoryTransactions = useMemo(() => {
        return transactions.filter(t => t.categoryId === category.id);
    }, [transactions, category.id]);

    const { transactionsWithBalance, totalCredit, totalDebit } = useMemo(() => {
        if (!postBankAccountId) return { transactionsWithBalance: [], totalCredit: 0, totalDebit: 0 };
        
        const chronologicalTxs = [...categoryTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        let creditTotal = 0;
        let debitTotal = 0;

        const transactionsWithDetails = chronologicalTxs.map(t => {
            let credit = null;
            let debit = null;
            let effect = 0;

            if (t.type === 'income' && t.accountId === postBankAccountId) {
                credit = t.amount;
                effect = t.amount;
                creditTotal += t.amount;
            } else if (t.type === 'expense' && t.accountId === postBankAccountId) {
                debit = t.amount;
                effect = -t.amount;
                debitTotal += t.amount;
            } else if (t.type === 'transfer') {
                if (t.toAccountId === postBankAccountId) {
                    credit = t.amount;
                    effect = t.amount;
                    creditTotal += t.amount;
                }
                if (t.fromAccountId === postBankAccountId) {
                    debit = t.amount;
                    effect = -t.amount;
                    debitTotal += t.amount;
                }
            }
            
            runningBalance += effect;
            return { ...t, credit, debit, balance: runningBalance };
        });

        return {
            transactionsWithBalance: transactionsWithDetails.reverse(), // Show newest first
            totalCredit: creditTotal,
            totalDebit: debitTotal,
        };
    }, [categoryTransactions, postBankAccountId]);

    return (
        <AccordionItem value={category.id}>
            <AccordionTrigger>
                <div className="flex w-full items-center">
                    <span className="font-semibold text-base">{category.name}</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex justify-center px-4 pb-4">
                    <Card className="bg-muted/50 w-full">
                        <CardHeader className="pb-2 flex-row justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CardDescription className="flex gap-4">
                                    <span>Total Credit: <span className="font-semibold text-green-600">{formatCurrency(totalCredit)}</span></span>
                                    <span>Total Debit: <span className="font-semibold text-red-600">{formatCurrency(totalDebit)}</span></span>
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right">Credit</TableHead>
                                            <TableHead className="text-right">Debit</TableHead>
                                            <TableHead className="text-right">Balance</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactionsWithBalance.length > 0 ? transactionsWithBalance.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell>{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                <TableCell>{t.description}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">
                                                    {t.credit !== null ? formatCurrency(t.credit) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600">
                                                    {t.debit !== null ? formatCurrency(t.debit) : null}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-mono", t.balance < 0 && "text-red-600")}>
                                                    {formatCurrency(t.balance)}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                    No transactions for this category in Post Bank.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AccordionContent>
        </AccordionItem>
    )
}

export function PostCategoryAccordion({ categories, transactions, postBankAccountId }: { categories: Category[], transactions: Transaction[], postBankAccountId: string | undefined }) {
  if (categories.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Post Bank Categories</CardTitle>
                <CardDescription>
                    Breakdown of Post Bank transactions by category.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <p>No transactions found for the Post Bank account.</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post Bank Categories</CardTitle>
        <CardDescription>
            Breakdown of Post Bank transactions by category.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
            {categories.map(category => (
                <CategoryAccordionItem
                    key={category.id}
                    category={category}
                    transactions={transactions}
                    postBankAccountId={postBankAccountId}
                />
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
