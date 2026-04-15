"use client";

import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Transaction, Account, Category, Loan } from "@/lib/data";
import { Pencil, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  if (Object.is(amount, -0)) {
    amount = 0;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function TransactionTable({
  transactions,
  accountId,
  primaryAccount,
  currentPage,
  itemsPerPage,
  onEditTransaction
}: {
  transactions: (Transaction & { balance: number })[];
  accountId: string;
  primaryAccount: Account | undefined;
  currentPage: number;
  itemsPerPage: number;
  onEditTransaction: (transaction: Transaction) => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [user] = useAuthState();
  const { toast } = useToast();

  const toggleRow = (id: string) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedRows(newSet);
  };

  const getAccountName = (accId?: string, paymentMethod?: Transaction['paymentMethod']) => {
    if (accId === 'cash-wallet' || paymentMethod === 'cash') return "Cash Wallet";
    if (accId === 'digital-wallet' || paymentMethod === 'digital') return "Digital Wallet";
    if (accId === 'cashback-source') return "Cashback/Reward";
    
    if (accId?.startsWith('loan-virtual-account-')) {
        const personName = accId.replace('loan-virtual-account-', '').replace(/-/g, ' ');
        const loan = loans.find(l => l.personName.toLowerCase() === personName.toLowerCase());
        return loan ? loan.personName : personName;
    }
    if (!accId) return "-";
    const account = accounts.find((a) => a.id === accId);
    return account ? account.name : "N/A";
  };

  const getLoanDisplayInfo = useMemo(() => {
    return (t: Transaction) => {
        const defaultInfo = { isLoan: false, type: t.type, category: t.category, description: t.description, descriptionClassName: "" };
        if (t.type === 'transfer') {
            if (t.loanTransactionId) {
                const loan = loans.find(l => l.transactions.some(lt => lt.id === t.loanTransactionId));
                if (loan) {
                    const loanTx = loan.transactions.find(lt => lt.id === t.loanTransactionId)!;
                    const isLoanTaken = loan.type === 'taken';
                    const isRepayment = loanTx.type === 'repayment';
                    let prefix = isLoanTaken ? (isRepayment ? 'Repayment to' : 'Loan from') : (isRepayment ? 'Repayment from' : 'Loan to');
                    return { isLoan: true, type: loanTx.type, category: 'Loan', description: `${prefix} ${loan.personName}`, descriptionClassName: 'text-orange-600 font-bold' };
                }
            }
            if (t.fromAccountId === primaryAccount?.id && (t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet')) 
                return { ...defaultInfo, type: 'issue' as const, description: `Issue to ${t.toAccountId.replace('-wallet', '')} Wallet` };
            if (t.toAccountId === primaryAccount?.id && (t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet'))
                return { ...defaultInfo, type: 'return' as const, description: `Return from ${t.fromAccountId.replace('-wallet', '')} Wallet` };
        }
        return defaultInfo;
    };
  }, [loans, primaryAccount]);

  const transactionsWithColumns = useMemo(() => {
    const isPrimaryView = primaryAccount?.id === accountId;
    const creditCardIds = accounts.filter(a => a.type === 'card').map(a => a.id);
    return transactions.map(t => {
      let debit = null, credit = null, transfer = null;
      const fromInEcosystem = isPrimaryView ? (t.fromAccountId === accountId || t.fromAccountId?.includes('wallet') || (t.fromAccountId && creditCardIds.includes(t.fromAccountId))) : t.fromAccountId === accountId;
      const toInEcosystem = isPrimaryView ? (t.toAccountId === accountId || t.toAccountId?.includes('wallet') || (t.toAccountId && creditCardIds.includes(t.toAccountId))) : t.toAccountId === accountId;

      if (t.type === 'income') {
          if (isPrimaryView && (t.accountId === accountId || t.accountId?.includes('wallet'))) credit = t.amount;
          else if (!isPrimaryView && t.accountId === accountId) credit = t.amount;
      } else if (t.type === 'expense') {
          if (isPrimaryView && (t.accountId === accountId || t.paymentMethod !== 'online' || (t.accountId && creditCardIds.includes(t.accountId)))) debit = t.amount;
          else if (!isPrimaryView && t.accountId === accountId) debit = t.amount;
      } else if (t.type === 'transfer') {
            if (fromInEcosystem && toInEcosystem) transfer = t.amount;
            else if (fromInEcosystem) debit = t.amount;
            else if (toInEcosystem) credit = t.amount;
      }
      return { ...t, debit, credit, transfer }
    });
  }, [transactions, accountId, primaryAccount, accounts]);

  useEffect(() => {
    if (user && db) {
      const unsubscribeAccounts = onSnapshot(query(collection(db, "accounts"), where("userId", "==", user.uid)), (s) => setAccounts(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account))));
      const unsubscribeCategories = onSnapshot(query(collection(db, "categories"), where("userId", "==", user.uid)), (s) => setCategories(s.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category))));
      const unsubscribeLoans = onSnapshot(query(collection(db, "loans"), where("userId", "==", user.uid)), (s) => {
        setLoans(s.docs.map(doc => {
            const data = doc.data(), txs = data.transactions || [];
            const totalL = txs.filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
            const totalR = txs.filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
            return { id: doc.id, ...data, transactions: txs, totalLoan: totalL, totalRepayment: totalR, balance: totalL - totalR } as Loan;
        }));
      });
      return () => { unsubscribeAccounts(); unsubscribeCategories(); unsubscribeLoans(); };
    }
  }, [user]);

  const handleDeleteTransaction = async (txToDelete: Transaction) => {
    if (!user) return;
    try {
        const batch = writeBatch(db), txRef = doc(db, "transactions", txToDelete.id);
        if (txToDelete.loanTransactionId) {
            const loansSnapshot = await getDocs(query(collection(db, "loans"), where("userId", "==", user.uid)));
            for (const loanDoc of loansSnapshot.docs) {
                const loanData = loanDoc.data() as Loan;
                if (loanData.transactions.some(t => t.id === txToDelete.loanTransactionId)) {
                    const updatedTxs = loanData.transactions.filter(t => t.id !== txToDelete.loanTransactionId);
                    if (updatedTxs.length > 0) batch.update(loanDoc.ref, { transactions: updatedTxs });
                    else batch.delete(loanDoc.ref);
                    break;
                }
            }
        }
        batch.delete(txRef); await batch.commit();
        toast({ title: "Transaction deleted successfully." });
    } catch (e: any) { toast({ variant: "destructive", title: "Deletion failed", description: e.message || "An unexpected error occurred." }); }
  };
  
  return (
    <div className="w-full">
      <Table className="min-w-[1000px]">
        <TableHeader className="sticky top-0 bg-background z-10 shadow-sm">
          <TableRow>
            <TableHead className="w-[50px]">Sl.</TableHead>
            <TableHead className="w-[100px]">Date</TableHead>
            <TableHead className="min-w-[200px]">Description</TableHead>
            <TableHead className="w-[90px]">Type</TableHead>
            <TableHead className="min-w-[150px]">Account</TableHead>
            <TableHead className="min-w-[120px]">Category</TableHead>
            <TableHead className="text-right w-[100px]">Debit</TableHead>
            <TableHead className="text-right w-[100px]">Transfer</TableHead>
            <TableHead className="text-right w-[100px]">Credit</TableHead>
            <TableHead className="text-right w-[120px]">Balance</TableHead>
            <TableHead className="text-right print-hide w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {transactionsWithColumns.map((t, index) => {
              const loanInfo = getLoanDisplayInfo(t);
              const isExpanded = expandedRows.has(t.id);
              const slNo = (currentPage - 1) * itemsPerPage + index + 1;
              return (
                  <Fragment key={t.id}>
                      <TableRow className={cn("hover:bg-muted/50", t.items?.length ? "cursor-pointer" : "", isExpanded && "bg-muted/40")} onClick={() => t.items?.length && toggleRow(t.id)}>
                          <TableCell className="py-2 text-xs">{slNo}</TableCell>
                          <TableCell className="py-2 text-xs">{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                          <TableCell className={cn("py-2 text-sm", loanInfo.descriptionClassName)}>{t.items?.length ? t.items.map(i => i.description).join('; ') : (loanInfo.description || t.description)}</TableCell>
                          <TableCell className="py-2"><Badge variant={t.type === 'income' ? 'default' : t.type === 'expense' ? 'destructive' : 'secondary'} className="text-[10px] h-5 capitalize">{t.type}</Badge></TableCell>
                          <TableCell className="py-2 text-xs leading-tight">{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} ➔ ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                          <TableCell className="py-2 text-xs leading-tight"><div>{t.items?.length ? 'Multiple' : loanInfo.category}</div>{t.subcategory && <div className="text-[10px] text-muted-foreground">{t.subcategory}</div>}</TableCell>
                          <TableCell className="text-right font-mono text-red-600 text-xs">{t.debit ? formatCurrency(t.debit) : '-'}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600 text-xs">{t.transfer ? formatCurrency(t.transfer) : '-'}</TableCell>
                          <TableCell className="text-right font-mono text-green-600 text-xs">{t.credit ? formatCurrency(t.credit) : '-'}</TableCell>
                          <TableCell className={cn("text-right font-mono text-xs", t.balance < 0 && 'text-red-600')}>{formatCurrency(t.balance)}</TableCell>
                          <TableCell className="text-right print-hide py-2" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditTransaction(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                                  <AlertDialog>
                                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-7 w-7"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                      <AlertDialogContent>
                                          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTransaction(t)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                                      </AlertDialogContent>
                                  </AlertDialog>
                              </div>
                          </TableCell>
                      </TableRow>
                      {isExpanded && t.items?.length && (
                          <TableRow className="bg-muted/20"><TableCell colSpan={11} className="p-0">
                              <div className="px-12 py-3 bg-muted/10 border-l-4 border-primary/20">
                                  <Table><TableBody>
                                      {t.items.map((item, i) => (
                                          <TableRow key={i} className="border-none hover:bg-transparent">
                                              <TableCell className="py-1 text-xs">{item.description}</TableCell>
                                              <TableCell className="py-1 text-xs">{item.category}</TableCell>
                                              <TableCell className="text-right font-mono text-xs py-1">{formatCurrency(item.amount)}</TableCell>
                                          </TableRow>
                                      ))}
                                  </TableBody></Table>
                              </div>
                          </TableCell></TableRow>
                      )}
                  </Fragment>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}