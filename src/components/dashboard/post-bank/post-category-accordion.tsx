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

    const { totalCredit, totalDebit } = useMemo(() => {
        let credit = 0;
        let debit = 0;
        categoryTransactions.forEach(t => {
            if (t.type === 'income') {
                credit += t.amount;
            } else if (t.type === 'expense') {
                debit += t.amount;
            } else if (t.type === 'transfer' && postBankAccountId) {
                if (t.toAccountId === postBankAccountId) {
                    credit += t.amount;
                }
                if (t.fromAccountId === postBankAccountId) {
                    debit += t.amount;
                }
            }
        });
        return { totalCredit: credit, totalDebit: debit };
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
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {categoryTransactions.length > 0 ? categoryTransactions.map(t => {
                                            let credit = null;
                                            let debit = null;

                                            if (t.type === 'income') {
                                                credit = t.amount;
                                            } else if (t.type === 'expense') {
                                                debit = t.amount;
                                            } else if (t.type === 'transfer' && postBankAccountId) {
                                                if (t.toAccountId === postBankAccountId) {
                                                    credit = t.amount;
                                                }
                                                if (t.fromAccountId === postBankAccountId) {
                                                    debit = t.amount;
                                                }
                                            }

                                            return (
                                                <TableRow key={t.id}>
                                                    <TableCell>{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                    <TableCell>{t.description}</TableCell>
                                                    <TableCell className="text-right font-mono text-green-600">
                                                        {credit !== null ? formatCurrency(credit) : null}
                                                    </TableCell>
                                                    <TableCell className="text-right font-mono text-red-600">
                                                        {debit !== null ? formatCurrency(debit) : null}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        }) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                                                    No transactions for this category.
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

export function PostCategoryAccordion({ categories, transactions, isEditable, postBankAccountId }: { categories: Category[], transactions: Transaction[], isEditable: boolean, postBankAccountId: string | undefined }) {
  if (categories.length === 0) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <p>No income categories found.</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Categories for Post Bank</CardTitle>
        <CardDescription>
            Breakdown of Post Bank transactions by income category.
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
