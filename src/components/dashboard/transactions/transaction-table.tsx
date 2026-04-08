
"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
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
import { Pencil, Trash2, ChevronRight } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, getDocs } from "firebase/firestore";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/hooks/use-auth-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";


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
  const [user] = useAuthState();
  const { toast } = useToast();

    const getAccountName = (accountId?: string, paymentMethod?: Transaction['paymentMethod']) => {
        if (accountId === 'cash-wallet' || paymentMethod === 'cash') return "Cash Wallet";
        if (accountId === 'digital-wallet' || paymentMethod === 'digital') return "Digital Wallet";
        
        if (accountId?.startsWith('loan-virtual-account-')) {
            const personName = accountId.replace('loan-virtual-account-', '').replace(/-/g, ' ');
            const loan = loans.find(l => l.personName.toLowerCase() === personName.toLowerCase());
            if (loan) return loan.personName;
            return personName;
        }
    
        if (!accountId) return "-";
        
        const account = accounts.find((a) => a.id === accountId);
        if (!account) {
             const loan = loans.find(l => l.id === accountId);
             if (loan) return loan.personName;
             return "N/A";
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
                        let descriptionPrefix = '';

                        if (isLoanTaken) {
                            descriptionPrefix = isRepayment ? 'Repayment to' : 'Loan from';
                        } else { // 'given'
                            descriptionPrefix = isRepayment ? 'Repayment from' : 'Loan to';
                        }
                        
                        const description = `${descriptionPrefix} ${otherPartyName}`;
                        return { isLoan: true, type: loanTx.type, category: 'Loan', description, descriptionClassName: 'text-orange-600 font-bold' };
                    }
                }
                
                const fromIsPrimaryBank = t.fromAccountId === primaryAccount?.id;
                const toIsPrimaryBank = t.toAccountId === primaryAccount?.id;
                const fromIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
                const toIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';

                if (fromIsPrimaryBank && toIsWallet) {
                    const toWalletName = t.toAccountId === 'cash-wallet' ? 'Cash' : 'Digital';
                    return { ...defaultInfo, type: 'issue' as const, description: `Issue to ${toWalletName} Wallet` };
                }

                if (fromIsWallet && toIsPrimaryBank) {
                    const fromWalletName = t.fromAccountId === 'cash-wallet' ? 'Cash' : 'Digital';
                    return { ...defaultInfo, type: 'return' as const, description: `Return from ${fromWalletName} Wallet` };
                }
            }
            
            return defaultInfo;
        };
    }, [loans, primaryAccount]);
    

  const transactionsWithColumns = useMemo(() => {
    const isPrimaryView = primaryAccount?.id === accountId;
    const creditCardIds = accounts.filter(a => a.type === 'card').map(a => a.id);

    return transactions.map(t => {
      let debit = null;
      let credit = null;
      let transfer = null;

      const fromAccountIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
      const toAccountIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
      
      const fromCurrentView = isPrimaryView 
          ? (t.fromAccountId === accountId || fromAccountIsWallet || (t.fromAccountId && creditCardIds.includes(t.fromAccountId)))
          : t.fromAccountId === accountId;

      const toCurrentView = isPrimaryView
          ? (t.toAccountId === accountId || toAccountIsWallet || (t.toAccountId && creditCardIds.includes(t.toAccountId)))
          : t.toAccountId === accountId;

      if (t.type === 'income') {
          if(isPrimaryView) {
                if (t.accountId === accountId || t.accountId === 'cash-wallet' || t.accountId === 'digital-wallet') credit = t.amount;
          } else {
                if (t.accountId === accountId) credit = t.amount;
          }
      } else if (t.type === 'expense') {
          if(isPrimaryView) {
              if (t.accountId === accountId || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || (t.accountId && creditCardIds.includes(t.accountId))) {
                  debit = t.amount;
              }
          } else {
                if (t.accountId === accountId) {
                  debit = t.amount;
              }
          }
      } else if (t.type === 'transfer') {
            if (fromCurrentView && toCurrentView) {
              transfer = t.amount;
            } else if (fromCurrentView) {
              debit = t.amount;
            } else if (toCurrentView) {
              credit = t.amount;
            }
      }
      
      return {
          ...t,
          debit,
          credit,
          transfer
      }
    });
  }, [transactions, accountId, primaryAccount, accounts]);


   useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(userAccounts);
      });
      
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        const userCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(userCategories);
      });
      
      const loansQuery = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribeLoans = onSnapshot(loansQuery, (snapshot) => {
        const userLoans = snapshot.docs.map(doc => {
            const data = doc.data();
            const transactions = data.transactions || [];
            const totalLoan = transactions.filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
            const totalRepayment = transactions.filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
            return {
                id: doc.id,
                ...data,
                transactions,
                totalLoan,
                totalRepayment,
                balance: totalLoan - totalRepayment,
            } as Loan;
        });
        setLoans(userLoans);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeCategories();
        unsubscribeLoans();
      };
    }
  }, [user, db]);

  const handleDeleteTransaction = async (transactionToDelete: Transaction) => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        const transactionRef = doc(db, "transactions", transactionToDelete.id);

        if (transactionToDelete.loanTransactionId) {
            // Find the parent loan document
            const loansQuery = query(collection(db, "loans"), where("userId", "==", user.uid));
            const loansSnapshot = await getDocs(loansQuery);

            for (const loanDoc of loansSnapshot.docs) {
                const loan = { id: loanDoc.id, ...loanDoc.data() } as Loan;
                const txIndex = loan.transactions.findIndex(t => t.id === transactionToDelete.loanTransactionId);

                if (txIndex !== -1) {
                    const updatedTransactions = loan.transactions.filter(t => t.id !== transactionToDelete.loanTransactionId);
                    
                    if (updatedTransactions.length > 0) {
                        batch.update(loanDoc.ref, { transactions: updatedTransactions });
                    } else {
                        // If no transactions are left, delete the entire loan document
                        batch.delete(loanDoc.ref);
                    }
                    break; // Exit loop once found and updated
                }
            }
        }

        batch.delete(transactionRef);
        await batch.commit();
        toast({ title: "Transaction deleted successfully." });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Deletion failed",
            description: error.message || "An unexpected error occurred."
        });
    }
  };
  
  const getBadgeVariant = (type: Transaction['type'] | 'loan' | 'repayment' | 'withdraw' | 'movement' | 'issue' | 'return') => {
    switch (type) {
      case 'income':
        return 'default';
      case 'expense':
        return 'destructive';
      case 'transfer':
      case 'loan':
      case 'repayment':
      case 'withdraw':
      case 'movement':
      case 'issue':
      case 'return':
      default:
        return 'secondary';
    }
  }

  return (
    <>
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Sl.</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right whitespace-nowrap">Debit</TableHead>
              <TableHead className="text-right whitespace-nowrap">Transfer</TableHead>
              <TableHead className="text-right whitespace-nowrap">Credit</TableHead>
              <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
              <TableHead className="text-right print-hide whitespace-nowrap">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
              {transactionsWithColumns.map((t, index) => {
                const loanInfo = getLoanDisplayInfo(t);
                
                if (t.items && t.items.length > 0) {
                    const concatenatedDescription = t.items.map(item => item.description).join('; ');

                    return (
                        <Collapsible asChild key={t.id}>
                            <Fragment>
                                <TableRow className="border-b-0 data-[state=open]:border-b cursor-pointer" onClick={(e) => {
                                    // Make sure we are not clicking a button
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button')) return;
                                    // Find and click the hidden trigger
                                    target.closest('tr')?.querySelector<HTMLButtonElement>('[data-collapsible-trigger]')?.click();
                                }}>
                                    <TableCell>{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                                    <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                                    <TableCell className="font-medium break-words">
                                        {concatenatedDescription}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariant(t.type)}>{t.type}</Badge>
                                    </TableCell>
                                    <TableCell className="break-words">{getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                                    <TableCell className="break-words">
                                        <Badge variant="outline">Multiple</Badge>
                                    </TableCell>
                                    
                                    <TableCell className="text-right font-mono text-red-600">
                                        {formatCurrency(t.amount)}
                                    </TableCell>
                                    <TableCell />
                                    <TableCell />
                                    
                                    <TableCell className={cn("text-right font-mono", t.balance < 0 ? 'text-red-600' : '')}>
                                        {formatCurrency(t.balance)}
                                    </TableCell>
                                    <TableCell className="text-right print-hide">
                                        <div className="flex items-center justify-end gap-2">
                                            <CollapsibleTrigger asChild>
                                                 <button data-collapsible-trigger className="hidden">Toggle</button>
                                            </CollapsibleTrigger>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEditTransaction(t); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete this combined transaction and all its items. This action cannot be undone.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTransaction(t)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                <CollapsibleContent asChild>
                                    <TableRow>
                                        <TableCell colSpan={11} className="p-0">
                                            <div className="p-4 bg-muted/30">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Item Description</TableHead>
                                                            <TableHead>Category</TableHead>
                                                            <TableHead className="text-right">Amount</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {t.items.map((item, itemIndex) => {
                                                            const categoryDoc = categories.find(c => c.id === item.categoryId || c.name === item.category);
                                                            return (
                                                                <TableRow key={itemIndex}>
                                                                    <TableCell>{item.description}</TableCell>
                                                                    <TableCell>
                                                                        {categoryDoc?.name || item.category}
                                                                        {item.subcategory && ` / ${item.subcategory}`}
                                                                    </TableCell>
                                                                    <TableCell className="text-right font-mono">{formatCurrency(item.amount)}</TableCell>
                                                                </TableRow>
                                                            )
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                </CollapsibleContent>
                            </Fragment>
                        </Collapsible>
                    )
                }

                const {debit, credit, transfer} = t;

                return (
                    <TableRow key={t.id}>
                        <TableCell className="font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                        <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className={cn("font-medium break-words", loanInfo.descriptionClassName)}>
                          {loanInfo.description}
                        </TableCell>
                        <TableCell>
                          <Badge 
                              variant={getBadgeVariant(loanInfo.type)}
                              className="capitalize"
                              >
                              {loanInfo.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="break-words">{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} -> ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                        <TableCell className="break-words">
                            <div>{loanInfo.category}</div>
                            {t.subcategory && <div className="text-sm text-muted-foreground">{t.subcategory}</div>}
                        </TableCell>
                        
                        <TableCell className="text-right font-mono text-red-600">
                          {debit !== null ? formatCurrency(debit) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {transfer !== null ? formatCurrency(transfer) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {credit !== null ? formatCurrency(credit) : null}
                        </TableCell>
                        
                        <TableCell className={cn("text-right font-mono", t.balance < 0 ? 'text-red-600' : '')}>
                          {formatCurrency(t.balance)}
                        </TableCell>
                        <TableCell className="text-right print-hide">
                            <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => onEditTransaction(t)} className="h-8 w-8">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the transaction. This action cannot be undone and will update account balances.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteTransaction(t)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
      <div className="hidden print-block">
        <div id="printable-area">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {transactions.map(t => (
                        <TableRow key={t.id}>
                            <TableCell>{format(new Date(t.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{t.description}</TableCell>
                            <TableCell>{t.type}</TableCell>
                            <TableCell>{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} -> ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                            <TableCell>{t.category}{t.subcategory ? ` / ${t.subcategory}` : ''}</TableCell>
                            <TableCell className={cn("text-right", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                                {t.type !== 'transfer' ? formatCurrency(t.amount) : '-'}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
      </div>
    </>
  );
}
