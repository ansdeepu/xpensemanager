
"use client";

import { useState, useEffect, useMemo } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Transaction, Account, Category, Bill, Loan } from "@/lib/data";
import { Pencil, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, doc, runTransaction, orderBy, getDocs, writeBatch } from "firebase/firestore";
import { format, isAfter, isSameDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/hooks/use-auth-state";


const formatCurrency = (amount: number) => {
    if (Object.is(amount, -0)) {
        amount = 0;
    }
    if (amount % 1 === 0) {
      return new Intl.NumberFormat("en-IN", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
    return new Intl.NumberFormat("en-IN", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};


// Function to safely evaluate math expressions
const evaluateMath = (expression: string): number | null => {
  try {
    // Basic validation: only allow numbers, operators, and parentheses
    if (/[^0-9+\-*/.() ]/.test(expression)) {
      return null;
    }
    // eslint-disable-next-line no-eval
    const result = eval(expression);
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return null;
  } catch (error) {
    return null;
  }
};


export function TransactionTable({
  transactions,
  accountId,
  primaryAccount,
  currentPage,
  itemsPerPage,
}: {
  transactions: (Transaction & { balance: number })[];
  accountId: string;
  primaryAccount: Account | undefined;
  currentPage: number;
  itemsPerPage: number;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [user] = useAuthState();
  const [editDate, setEditDate] = useState<Date | undefined>(new Date());
  const [editCategory, setEditCategory] = useState<string | undefined>();
  const [editSubCategory, setEditSubCategory] = useState<string | undefined>();
  const [editSelectedAccountId, setEditSelectedAccountId] = useState<string | undefined>();
  const { toast } = useToast();
  
  const [editAmount, setEditAmount] = useState("");

  const handleAmountChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };
  
  const handleAmountBlur = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (value.trim() === "") return;
    const result = evaluateMath(value);
    if (result !== null) {
      setter(String(result));
    }
  };

   const editSubcategories = useMemo(() => {
    if (!editCategory) return [];
    const category = categories.find(c => c.id === editCategory);
    return category?.subcategories || [];
    }, [editCategory, categories]);

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

    const primaryAccountFromProps = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);
    
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
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(userAccounts);
      });
      
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), orderBy("order", "asc"));
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

  useEffect(() => {
    if (selectedTransaction) {
      setEditDate(new Date(selectedTransaction.date));
      setEditAmount(String(selectedTransaction.amount));
       const accountId = selectedTransaction.paymentMethod === 'cash' ? 'cash-wallet' 
                        : selectedTransaction.paymentMethod === 'digital' ? 'digital-wallet' 
                        : selectedTransaction.accountId;
      setEditSelectedAccountId(accountId);
      if (selectedTransaction.type === 'expense' || selectedTransaction.type === 'income') {
        const categoryDoc = categories.find(c => c.id === selectedTransaction.categoryId);
        setEditCategory(categoryDoc?.id);
        setEditSubCategory(selectedTransaction.subcategory);
      }
    } else {
        setEditDate(undefined);
        setEditCategory(undefined);
        setEditSubCategory(undefined);
        setEditAmount("");
        setEditSelectedAccountId(undefined);
    }
   }, [selectedTransaction, categories]);
  
  const handleEditTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedTransaction) return;
  
    const formData = new FormData(event.currentTarget);
    const dateString = formData.get("date") as string;
    const transactionDate = dateString ? new Date(dateString) : new Date();

    const updatedData: Partial<Transaction> = {
      description: formData.get("description") as string,
      amount: parseFloat(editAmount),
      date: transactionDate.toISOString(),
    };
  
    try {
      await runTransaction(db, async (t) => {
        const transactionRef = doc(db, "transactions", selectedTransaction.id);
        const oldTransactionDoc = await t.get(transactionRef);
        if (!oldTransactionDoc.exists()) throw "Transaction not found";
        
        if (selectedTransaction.type === 'income' || selectedTransaction.type === 'expense') {
          const newAccountId = formData.get("account") as string;
          
           if (selectedTransaction.type === 'expense') {
              if (newAccountId === 'cash-wallet') {
                updatedData.paymentMethod = 'cash';
                delete updatedData.accountId;
              } else if (newAccountId === 'digital-wallet') {
                updatedData.paymentMethod = 'digital';
                delete updatedData.accountId;
              } else {
                updatedData.paymentMethod = 'online';
                updatedData.accountId = newAccountId;
              }
            } else { // Income
              updatedData.paymentMethod = 'online';
              updatedData.accountId = newAccountId;
            }
  
          if (selectedTransaction.type === 'expense' || selectedTransaction.type === 'income') {
            const categoryId = formData.get('category') as string;
            const subcategory = formData.get('subcategory') as string;
            const categoryDoc = categories.find(c => c.id === categoryId);
            updatedData.category = categoryDoc?.name || 'Uncategorized';
            updatedData.categoryId = categoryId;
            updatedData.subcategory = subcategory || "";
          }
        } else if (selectedTransaction.type === 'transfer') {
          updatedData.fromAccountId = formData.get("fromAccount") as string;
          updatedData.toAccountId = formData.get("toAccount") as string;
  
          if (updatedData.fromAccountId === updatedData.toAccountId) {
            throw new Error("From and To accounts cannot be the same.");
          }
  
          const fromAccountName = getAccountName(updatedData.fromAccountId);
          const toAccountName = getAccountName(updatedData.toAccountId);
          updatedData.description = formData.get("description") as string || `Transfer from ${fromAccountName} to ${toAccountName}`;
        }
  
        t.update(transactionRef, updatedData);
      });
  
      setIsEditDialogOpen(false);
      setSelectedTransaction(null);
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: error.message || "An unexpected error occurred."
        })
    }
  };


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

  const openEditDialog = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
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

  const getLoanAmountColor = (loanInfo: { type: string }) => {
    if (loanInfo.type.includes('Repayment')) {
      return 'text-blue-600';
    }
    if (loanInfo.type.includes('Loan Given')) {
      return 'text-red-600';
    }
    if (loanInfo.type.includes('Loan from') || loanInfo.type.includes('Loan Taken')) {
      return 'text-green-600';
    }
    return 'text-blue-600'; // Default for transfers
  };

  const isPrimaryView = primaryAccount?.id === accountId;

  const postBankAccount = useMemo(() => accounts.find(a => a.name.toLowerCase().includes('post bank')), [accounts]);
  const isPostBankView = accountId === postBankAccount?.id;

  return (
    <>
      <div className="relative h-[calc(100vh_-_25rem)] w-full overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="whitespace-nowrap">Sl.</TableHead>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="whitespace-nowrap">Description</TableHead>
              <TableHead className="whitespace-nowrap">Type</TableHead>
              <TableHead className="whitespace-nowrap">Account</TableHead>
              <TableHead className="whitespace-nowrap">Category</TableHead>
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
                
                const {debit, credit, transfer} = t;

                return (
                  <TableRow key={t.id}>
                      <TableCell className="font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                      <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                      <TableCell className={cn("font-medium break-words", loanInfo.descriptionClassName)}>{loanInfo.description}</TableCell>
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
                              <Button variant="ghost" size="icon" onClick={() => openEditDialog(t)} className="h-8 w-8">
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

      {/* Edit Transaction Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
              <form onSubmit={handleEditTransaction}>
                  <DialogHeader>
                      <DialogTitle>Edit Transaction</DialogTitle>
                      <DialogDescription>
                          Update the details for your transaction. The transaction type cannot be changed.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                          <Label htmlFor="edit-date">Date</Label>
                          <Input id="edit-date" name="date" type="date" defaultValue={selectedTransaction ? format(new Date(selectedTransaction.date), 'yyyy-MM-dd') : ''} required />
                      </div>

                      
                          <div className="space-y-2">
                              <Label htmlFor="edit-description">Description</Label>
                              <Input id="edit-description" name="description" defaultValue={selectedTransaction?.description} />
                          </div>
                      

                      {(selectedTransaction?.type === 'expense' || selectedTransaction?.type === 'income') && (
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor="edit-category">Category</Label>
                                  <Select name="category" onValueChange={(value) => { setEditCategory(value); setEditSubCategory(undefined); }} value={editCategory}>
                                      <SelectTrigger id="edit-category">
                                          <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                          <SelectContent>
                                              {categories.filter(c => {
                                                  const isEditingPostBankTx = editSelectedAccountId === postBankAccount?.id;
                                                  if (isEditingPostBankTx && (selectedTransaction?.type === 'expense' || selectedTransaction?.type === 'income')) {
                                                    return c.type === 'income' || c.type === 'expense' || c.type === 'bank-expense';
                                                  }
                                                  if (selectedTransaction?.type === 'expense') {
                                                      return c.type === 'expense' || c.type === 'bank-expense';
                                                  }
                                                  return c.type === selectedTransaction?.type;
                                              }).map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                          </SelectContent>
                                  </Select>
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="edit-subcategory">Sub-category</Label>
                                  <Select name="subcategory" value={editSubCategory} onValueChange={setEditSubCategory} disabled={!editCategory || editSubcategories.length === 0}>
                                      <SelectTrigger id="edit-subcategory">
                                          <SelectValue placeholder="Select sub-category" />
                                      </SelectTrigger>
                                          <SelectContent>
                                              {editSubcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                          </SelectContent>
                                  </Select>
                              </div>
                          </div>
                      )}
                      
                      {(selectedTransaction?.type === 'income' || selectedTransaction?.type === 'expense') && (
                           <div className="space-y-2">
                              <Label htmlFor="edit-account">
                                  {selectedTransaction?.type === 'expense' ? 'Payment Method' : 'Bank Account'}
                              </Label>
                              <Select name="account" required value={editSelectedAccountId} onValueChange={setEditSelectedAccountId}>
                                  <SelectTrigger id="edit-account">
                                      <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                      <SelectContent>
                                          {selectedTransaction?.type === 'expense' && (
                                          <>
                                              <SelectItem value="cash-wallet">Cash Wallet</SelectItem>
                                              <SelectItem value="digital-wallet">Digital Wallet</SelectItem>
                                          </>
                                          )}
                                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                      </SelectContent>
                              </Select>
                          </div>
                      )}

                      {selectedTransaction?.type === 'transfer' && (
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor="edit-from-account">From Account</Label>
                                  <Select name="fromAccount" required defaultValue={selectedTransaction.fromAccountId}>
                                      <SelectTrigger id="edit-from-account"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                          <SelectItem value="cash-wallet">Cash Wallet</SelectItem>
                                          <SelectItem value="digital-wallet">Digital Wallet</SelectItem>
                                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                          </SelectContent>
                                  </Select>
                              </div>
                               <div className="space-y-2">
                                  <Label htmlFor="edit-to-account">To Account</Label>
                                  <Select name="toAccount" required defaultValue={selectedTransaction.toAccountId}>
                                      <SelectTrigger id="edit-to-account"><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                          <SelectItem value="cash-wallet">Cash Wallet</SelectItem>
                                          <SelectItem value="digital-wallet">Digital Wallet</SelectItem>
                                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                          </SelectContent>
                                  </Select>
                              </div>
                          </div>
                      )}

                      <div className="space-y-2">
                          <Label htmlFor="edit-amount">Amount</Label>
                          <Input
                              id="edit-amount"
                              name="amount"
                              placeholder="e.g. 100/2"
                              required
                              className="hide-number-arrows"
                              value={editAmount}
                              onChange={handleAmountChange(setEditAmount)}
                              onBlur={() => handleAmountBlur(editAmount, setEditAmount)}
                          />
                      </div>
                  </div>
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary" onClick={() => setSelectedTransaction(null)}>Cancel</Button></DialogClose>
                      <Button type="submit">Save Changes</Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </>
  );
}

    