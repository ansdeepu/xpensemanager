
"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  onEditTransaction,
  onBalanceClick
}: {
  transactions: (Transaction & { balance: number, breakdown?: any })[];
  accountId: string;
  primaryAccount: Account | undefined;
  currentPage: number;
  itemsPerPage: number;
  onEditTransaction: (transaction: Transaction) => void;
  onBalanceClick?: (transaction: any) => void;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [user] = useAuthState();
  const { toast } = useToast();

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
    if (!account) {
         const loan = loans.find(l => l.id === accountId);
         return loan ? loan.personName : "N/A";
    }
    return account.name;
  };

  const getLoanDisplayInfo = useMemo(() => {
    return (t: Transaction) => {
        const defaultInfo = { isLoan: false, type: t.type, category: t.category, description: t.description, descriptionClassName: "" };
        if (t.type === 'transfer') {
            if (t.loanTransactionId) {
                const loan = loans.find(l => l.transactions.some(lt => lt.id === t.loanTransactionId));
                if (loan) {
                    const loanTx = loan.transactions.find(lt => lt.id === t.loanTransactionId)!;
                    const otherPartyName = loan.personName;
                    const isLoanTaken = loan.type === 'taken';
                    const isRepayment = loanTx.type === 'repayment';
                    let descriptionPrefix = isLoanTaken ? (isRepayment ? 'Repayment to' : 'Loan from') : (isRepayment ? 'Repayment from' : 'Loan to');
                    return { isLoan: true, type: loanTx.type, category: 'Loan', description: `${descriptionPrefix} ${otherPartyName}`, descriptionClassName: 'text-orange-600 font-bold' };
                }
            }
            const fromIsPrimaryBank = t.fromAccountId === primaryAccount?.id;
            const toIsPrimaryBank = t.toAccountId === primaryAccount?.id;
            const fromIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
            const toIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
            if (fromIsPrimaryBank && toIsWallet) return { ...defaultInfo, type: 'issue' as const, description: `Issue to ${t.toAccountId === 'cash-wallet' ? 'Cash' : 'Digital'} Wallet` };
            if (fromIsWallet && toIsPrimaryBank) return { ...defaultInfo, type: 'return' as const, description: `Return from ${t.fromAccountId === 'cash-wallet' ? 'Cash' : 'Digital'} Wallet` };
        }
        return defaultInfo;
    };
  }, [loans, primaryAccount]);

  const transactionsWithColumns = useMemo(() => {
    const isPrimaryView = primaryAccount?.id === accountId;
    const creditCardIds = accounts.filter(a => a.type === 'card').map(a => a.id);
    return transactions.map(t => {
      let debit = null, credit = null, transfer = null;
      const fromAccountIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
      const toAccountIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
      const fromCurrentView = isPrimaryView ? (t.fromAccountId === accountId || fromAccountIsWallet || (t.fromAccountId && creditCardIds.includes(t.fromAccountId))) : t.fromAccountId === accountId;
      const toCurrentView = isPrimaryView ? (t.toAccountId === accountId || toAccountIsWallet || (t.toAccountId && creditCardIds.includes(t.toAccountId))) : t.toAccountId === accountId;

      if (t.type === 'income') {
          if (isPrimaryView && (t.accountId === accountId || t.accountId === 'cash-wallet' || t.accountId === 'digital-wallet')) credit = t.amount;
          else if (!isPrimaryView && t.accountId === accountId) credit = t.amount;
      } else if (t.type === 'expense') {
          if (isPrimaryView && (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || (t.accountId && creditCardIds.includes(t.accountId)))) debit = t.amount;
          else if (!isPrimaryView && t.accountId === accountId) debit = t.amount;
      } else if (t.type === 'transfer') {
            if (fromCurrentView && toCurrentView) transfer = t.amount;
            else if (fromCurrentView) debit = t.amount;
            else if (toCurrentView) credit = t.amount;
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
  
  const getBadgeVariant = (type: string) => type === 'income' ? 'default' : type === 'expense' ? 'destructive' : 'secondary';

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
              const isMultiItem = Boolean(t.items && t.items.length > 0);
              const slNo = (currentPage - 1) * itemsPerPage + index + 1;

              return (
                  <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="py-2 text-xs">{slNo}</TableCell>
                      <TableCell className="py-2 text-xs">{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                      <TableCell className="py-2">
                          {isMultiItem ? (
                              <div className="flex flex-col gap-1">
                                  <div className="h-5" />
                                  <div className="flex flex-col gap-0.5">
                                      {t.items!.map((item, i) => (
                                          <div key={i} className="text-sm leading-tight border-b border-muted/30 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                                              {item.description}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              <div className={cn("text-sm leading-tight", loanInfo.descriptionClassName)}>
                                  {loanInfo.description || t.description}
                              </div>
                          )}
                      </TableCell>
                      <TableCell className="py-2"><Badge variant={getBadgeVariant(t.type)} className="text-[10px] h-5 capitalize">{t.type}</Badge></TableCell>
                      <TableCell className="py-2 text-xs leading-tight">{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} ➔ ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                      <TableCell className="py-2 text-xs leading-tight">
                          {isMultiItem ? (
                              <div className="flex flex-col gap-1">
                                  <span className="font-medium text-blue-600 h-5 flex items-center">Multiple</span>
                                  <div className="text-[10px] text-muted-foreground leading-tight space-y-0.5">
                                      {Array.from(new Set(t.items?.map(item => {
                                          const catName = categories.find(c => c.id === item.categoryId || c.name === item.category)?.name || item.category;
                                          return `${catName}${item.subcategory ? ` / ${item.subcategory}` : ''}`;
                                      }))).map((combined, i) => (
                                          <div key={i}>{combined}</div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              <div className="flex flex-col">
                                  <div>{loanInfo.category}</div>
                                  {t.subcategory && <div className="text-[10px] text-muted-foreground">{t.subcategory}</div>}
                              </div>
                          )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-red-600 text-xs">
                          {isMultiItem && t.debit !== null ? (
                              <div className="flex flex-col gap-1">
                                  <span className="font-bold h-5 flex items-center justify-end">{formatCurrency(t.debit)}</span>
                                  <div className="flex flex-col gap-0.5 text-muted-foreground opacity-70">
                                      {t.items!.map((item, i) => (
                                          <div key={i} className="leading-tight border-b border-muted/30 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                                              {formatCurrency(item.amount)}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              t.debit !== null ? formatCurrency(t.debit) : null
                          )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-blue-600 text-xs">
                          {isMultiItem && t.transfer !== null ? (
                              <div className="flex flex-col gap-1">
                                  <span className="font-bold h-5 flex items-center justify-end">{formatCurrency(t.transfer)}</span>
                                  <div className="flex flex-col gap-0.5 text-muted-foreground opacity-70">
                                      {t.items!.map((item, i) => (
                                          <div key={i} className="leading-tight border-b border-muted/30 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                                              {formatCurrency(item.amount)}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              t.transfer !== null ? formatCurrency(t.transfer) : null
                          )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-green-600 text-xs">
                          {isMultiItem && t.credit !== null ? (
                              <div className="flex flex-col gap-1">
                                  <span className="font-bold h-5 flex items-center justify-end">{formatCurrency(t.credit)}</span>
                                  <div className="flex flex-col gap-0.5 text-muted-foreground opacity-70">
                                      {t.items!.map((item, i) => (
                                          <div key={i} className="leading-tight border-b border-muted/30 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">
                                              {formatCurrency(item.amount)}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          ) : (
                              t.credit !== null ? formatCurrency(t.credit) : null
                          )}
                      </TableCell>
                      <TableCell 
                        className={cn("text-right font-mono text-xs cursor-pointer hover:underline underline-offset-4 decoration-primary/30", t.balance < 0 ? 'text-red-600' : '')}
                        onClick={(e) => {
                            e.stopPropagation();
                            onBalanceClick?.(t);
                        }}
                      >
                          {formatCurrency(t.balance)}
                      </TableCell>
                      <TableCell className="text-right print-hide py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditTransaction(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="text-destructive h-7 w-7">
                                          <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                          <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => handleDeleteTransaction(t)} className="bg-destructive">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                          </div>
                      </TableCell>
                  </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
