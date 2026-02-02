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
    accountId,
}: {
    category: Category;
    transactions: Transaction[];
    accountId: string | undefined;
}) {
    const categoryTransactions = useMemo(() => {
        // Filter transactions by the category name
        return transactions.filter(t => t.category === category.name);
    }, [transactions, category.name]);

    const { transactionsWithCreditDebit, totalCredit, totalDebit } = useMemo(() => {
        if (!accountId) return { transactionsWithCreditDebit: [], totalCredit: 0, totalDebit: 0 };
        
        const chronologicalTxs = [...categoryTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let creditTotal = 0;
        let debitTotal = 0;

        const transactionsWithDetails = chronologicalTxs.map(t => {
            let credit = null;
            let debit = null;

            if (t.type === 'income' && t.accountId === accountId) {
                credit = t.amount;
                creditTotal += t.amount;
            } else if (t.type === 'expense' && t.accountId === accountId) {
                debit = t.amount;
                debitTotal += t.amount;
            } else if (t.type === 'transfer') {
                if (t.toAccountId === accountId) {
                    credit = t.amount;
                    creditTotal += t.amount;
                }
                if (t.fromAccountId === accountId) {
                    debit = t.amount;
                    debitTotal += t.amount;
                }
            }
            
            return { ...t, credit, debit };
        });

        return {
            transactionsWithCreditDebit: transactionsWithDetails.reverse(), // Show newest first
            totalCredit: creditTotal,
            totalDebit: debitTotal,
        };
    }, [categoryTransactions, accountId]);

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
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactionsWithCreditDebit.length > 0 ? transactionsWithCreditDebit.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell>{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                <TableCell>{t.description}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600">
                                                    {t.credit !== null ? formatCurrency(t.credit) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600">
                                                    {t.debit !== null ? formatCurrency(t.debit) : null}
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                    No transactions for this category in Post Bank account.
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
                    Breakdown of Post Bank account transactions.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <p>No categories specified.</p>
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
            Breakdown of Post Bank account transactions by the specified categories.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
            {categories.map(category => (
                <CategoryAccordionItem
                    key={category.id}
                    category={category}
                    transactions={transactions}
                    accountId={postBankAccountId}
                />
            ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
