
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Account } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { format, startOfDay } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function DateWiseExpenses() {
  const [user, userLoading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        setAccounts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account)));
        if (dataLoading) setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
      };
    } else if (!user && !userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { primaryAccount, creditCardIds } = useMemo(() => {
    const primary = accounts.find(a => a.isPrimary);
    const ccIds = accounts.filter(acc => acc.type === 'card').map(acc => acc.id);
    return { primaryAccount: primary, creditCardIds: ccIds };
  }, [accounts]);

  const ecosystemOutflowsForDate = useMemo(() => {
    if (!selectedDate || !primaryAccount) return [];
    
    const targetDateString = format(startOfDay(new Date(selectedDate)), 'yyyy-MM-dd');

    const isInEcosystem = (id?: string, method?: string) => 
        id === primaryAccount.id || 
        id === 'cash-wallet' || 
        id === 'digital-wallet' || 
        method === 'cash' || 
        method === 'digital' || 
        (id ? creditCardIds.includes(id) : false);

    return transactions.filter(t => {
      const txDateString = format(startOfDay(new Date(t.date)), 'yyyy-MM-dd');
      if (txDateString !== targetDateString) return false;

      if (t.type === 'expense') {
        return isInEcosystem(t.accountId, t.paymentMethod);
      }
      if (t.type === 'transfer') {
        return isInEcosystem(t.fromAccountId) && !isInEcosystem(t.toAccountId);
      }
      return false;
    });
  }, [transactions, selectedDate, primaryAccount, creditCardIds]);

  const groupedOutflows = useMemo(() => {
    const groups: {
      primary: Transaction[];
      cash: Transaction[];
      digital: Transaction[];
      cards: Transaction[];
    } = { primary: [], cash: [], digital: [], cards: [] };

    ecosystemOutflowsForDate.forEach(t => {
      if (t.paymentMethod === 'cash' || t.fromAccountId === 'cash-wallet') {
        groups.cash.push(t);
      } else if (t.paymentMethod === 'digital' || t.fromAccountId === 'digital-wallet') {
        groups.digital.push(t);
      } else if (t.accountId === primaryAccount?.id || t.fromAccountId === primaryAccount?.id) {
        groups.primary.push(t);
      } else if (t.fromAccountId && creditCardIds.includes(t.fromAccountId)) {
        groups.cards.push(t);
      } else if (t.accountId && creditCardIds.includes(t.accountId)) {
        groups.cards.push(t);
      }
    });

    return groups;
  }, [ecosystemOutflowsForDate, primaryAccount, creditCardIds]);

  const totals = useMemo(() => {
    return {
      primary: groupedOutflows.primary.reduce((sum, t) => sum + t.amount, 0),
      cash: groupedOutflows.cash.reduce((sum, t) => sum + t.amount, 0),
      digital: groupedOutflows.digital.reduce((sum, t) => sum + t.amount, 0),
      cards: groupedOutflows.cards.reduce((sum, t) => sum + t.amount, 0),
    };
  }, [groupedOutflows]);

  if (userLoading || dataLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const renderOutflowTable = (title: string, transactions: Transaction[], total: number) => (
    (transactions.length > 0) && (
      <div className="pt-4">
        <h4 className="font-semibold mb-2">{title} Outflows</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(t => (
              <TableRow key={t.id}>
                <TableCell>{t.description}</TableCell>
                <TableCell>{t.type === 'transfer' ? 'External Transfer' : (t.category || 'Expense')}{t.subcategory ? ` / ${t.subcategory}` : ''}</TableCell>
                <TableCell className="text-right">{formatCurrency(t.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2} className="text-right font-bold">Total</TableCell>
              <TableCell className="text-right font-bold">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    )
  );

  const grandTotal = totals.primary + totals.cash + totals.digital + totals.cards;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date-wise Outflows (Primary Ecosystem)</CardTitle>
        <CardDescription>Spending breakdown for the selected date from primary account, wallets, and cards.</CardDescription>
        <div className="flex items-center gap-2 pt-2">
          <Label htmlFor="expense-date" className="flex-shrink-0">Select Date:</Label>
          <Input
            id="expense-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full sm:w-auto"
          />
        </div>
      </CardHeader>
      <CardContent>
        {ecosystemOutflowsForDate.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
                <p>No primary ecosystem outflows recorded on {format(new Date(selectedDate), 'PPP')}.</p>
            </div>
        ) : (
          <>
            {primaryAccount && renderOutflowTable(`Primary Account (${primaryAccount.name})`, groupedOutflows.primary, totals.primary)}
            {renderOutflowTable("Cash Wallet", groupedOutflows.cash, totals.cash)}
            {renderOutflowTable("Digital Wallet", groupedOutflows.digital, totals.digital)}
            {renderOutflowTable("Credit Cards", groupedOutflows.cards, totals.cards)}
            
            <div className="border-t mt-6 pt-4">
              <div className="flex justify-between items-center font-bold text-lg">
                <span>Grand Total Outflow</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
