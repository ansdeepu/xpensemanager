
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogPortal,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Transaction, Account, Category, Bill, Loan, LoanTransaction } from "@/lib/data";
import { PlusCircle, Pencil, Trash2, CalendarIcon, Printer, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, XCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, runTransaction, orderBy, deleteDoc, getDoc, getDocs, limit, writeBatch, updateDoc } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths, addQuarters, addYears, isAfter, isWithinInterval, startOfDay, endOfDay, isBefore, parseISO, isSameDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useAuthState } from "@/hooks/use-auth-state";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
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
  accountId,
}: {
  accountId: string;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [user] = useAuthState();
  const [activeTab, setActiveTab] = useState("expense");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | undefined>();
  const [selectedIncomeCategory, setSelectedIncomeCategory] = useState<string | undefined>();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [editDate, setEditDate] = useState<Date | undefined>(new Date());
  const [editCategory, setEditCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;
  const { toast } = useToast();
  
  const [expenseAmount, setExpenseAmount] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
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

  const expenseCategories = useMemo(() => {
    const regularExpenses = categories.filter(c => c.type === 'expense');
    const bankExpenses = categories.filter(c => c.type === 'bank-expense');
    return [...regularExpenses, ...bankExpenses];
  }, [categories]);

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);

  const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const balances: { [key: string]: number } = {};
    accounts.forEach(acc => {
      balances[acc.id] = 0;
    });

    let cash = 0;
    let digital = 0;
    transactions.forEach((t) => {
      if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
        balances[t.accountId] += t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && balances[t.accountId] !== undefined) {
          balances[t.accountId] -= t.amount;
        } else if (t.paymentMethod === 'cash') {
          cash -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          digital -= t.amount;
        }
      } else if (t.type === 'transfer') {
        if (t.fromAccountId && balances[t.fromAccountId] !== undefined) {
          balances[t.fromAccountId] -= t.amount;
        } else if (t.fromAccountId === 'cash-wallet') {
          cash -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          digital -= t.amount;
        }
        if (t.toAccountId && balances[t.toAccountId] !== undefined) {
          balances[t.toAccountId] += t.amount;
        } else if (t.toAccountId === 'cash-wallet') {
          cash += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          digital += t.amount;
        }
      }
    });
    return { cashWalletBalance: cash, digitalWalletBalance: digital, accountBalances: balances };
  }, [transactions, accounts]);

  const fullAccounts = useMemo(() => 
    accounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0
    })), [accounts, accountBalances]
  );


  const expenseSubcategories = useMemo(() => {
    if (!selectedExpenseCategory) return [];
    const category = expenseCategories.find(c => c.id === selectedExpenseCategory);
    return category?.subcategories || [];
  }, [selectedExpenseCategory, expenseCategories]);

  const incomeSubcategories = useMemo(() => {
    if (!selectedIncomeCategory) return [];
    const category = incomeCategories.find(c => c.id === selectedIncomeCategory);
    return category?.subcategories || [];
  }, [selectedIncomeCategory, incomeCategories]);


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

    const getLoanDisplayInfo = (t: Transaction) => {
      const defaultInfo = { isLoan: false, type: t.type, category: t.category, description: t.description, colorClass: '' };
      if (t.type !== 'transfer' || !t.loanTransactionId) {
          return defaultInfo;
      }
  
      const currentAccount = accounts.find(a => a.id === accountId);
      const isVirtualAccountView = currentAccount && !currentAccount.isPrimary;
  
      for (const loan of loans) {
          const loanTx = loan.transactions.find(lt => lt.id === t.loanTransactionId);
          if (loanTx) {
              let type: string;
              let description: string = t.description;
  
              if (isVirtualAccountView && currentAccount?.name === loan.personName) {
                  // Viewing from the other party's perspective
                  const otherPartyAccountName = getAccountName(loanTx.accountId);
                  if (loan.type === 'taken') { // User took a loan from this person (Post Bank)
                      type = loanTx.type === 'loan' ? 'Loan Given' : 'Repayment Received';
                      description = `${type} ${loanTx.type === 'loan' ? 'to' : 'from'} ${otherPartyAccountName}`;
                  } else { // User gave a loan to this person
                      type = loanTx.type === 'loan' ? 'Loan Taken' : 'Repayment Made';
                      description = `${type} ${loanTx.type === 'loan' ? 'from' : 'to'} ${otherPartyAccountName}`;
                  }
              } else {
                  // Viewing from the user's main account perspective
                  if (loan.type === 'given') {
                      type = loanTx.type === 'loan' ? "Loan Given" : "Repayment Received";
                      description = `${type} ${loanTx.type === 'loan' ? 'to' : 'from'} ${loan.personName}`;
                  } else { // loan.type === 'taken'
                      type = loanTx.type === 'loan' ? "Loan from" : "Repayment to";
                      description = `${type} ${loan.personName}`;
                  }
              }
              return { isLoan: true, type, category: 'Loan', description, colorClass: 'bg-orange-100 dark:bg-orange-900/50' };
          }
      }
      return defaultInfo;
    };
    

    const filteredTransactions = useMemo(() => {
        const primaryAccount = accounts.find(a => a.isPrimary);
        const isPrimaryView = primaryAccount?.id === accountId;
        
        const currentVirtualAccountName = accounts.find(a => a.id === accountId)?.name;

        const sourceTransactions = transactions.filter(t => {
            if (isPrimaryView) {
                return (
                    (t.accountId === accountId && t.paymentMethod === 'online') ||
                    t.paymentMethod === 'cash' ||
                    t.paymentMethod === 'digital' ||
                    t.fromAccountId === accountId || t.toAccountId === accountId ||
                    t.fromAccountId === 'cash-wallet' || t.toAccountId === 'cash-wallet' ||
                    t.fromAccountId === 'digital-wallet' || t.toAccountId === 'digital-wallet'
                );
            } else {
                 const isDirectlyInvolved = t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId;

                 const involvedLoanParty = loans.find(l => {
                    if (l.personName === currentVirtualAccountName) {
                        return l.transactions.some(lt => lt.id === t.loanTransactionId);
                    }
                    return false;
                 });
                 
                 return isDirectlyInvolved || !!involvedLoanParty;
            }
        });

        let filtered = [...sourceTransactions];

        if (dateRange?.from && dateRange?.to) {
            const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
            filtered = filtered.filter(t => isWithinInterval(new Date(t.date), interval));
        }

        if (searchQuery) {
            const lowercasedQuery = searchQuery.toLowerCase();
            filtered = filtered.filter(t => 
                t.description.toLowerCase().includes(lowercasedQuery) ||
                t.category.toLowerCase().includes(lowercasedQuery) ||
                (t.subcategory && t.subcategory.toLowerCase().includes(lowercasedQuery)) ||
                t.amount.toString().toLowerCase().includes(lowercasedQuery)
            );
        }
        
        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, accountId, dateRange, searchQuery, accounts, loans]);

  const transactionsWithBalance = useMemo(() => {
    const primaryAccount = accounts.find(a => a.isPrimary);
    const isPrimaryView = primaryAccount?.id === accountId;

    const accountPreferences = accounts.find(a => a.id === accountId);
    let reconciliationBalance: number;
    let reconciliationDate: Date;

    if (isPrimaryView) {
        const primaryReconDate = primaryAccount?.actualBalanceDate ? parseISO(primaryAccount.actualBalanceDate) : new Date(0);
        const cashWallet = fullAccounts.find(a => a.id === 'cash-wallet');
        const digitalWallet = fullAccounts.find(a => a.id === 'digital-wallet');
        const cashReconDate = cashWallet?.actualBalanceDate ? parseISO(cashWallet.actualBalanceDate) : new Date(0);
        const digitalReconDate = digitalWallet?.actualBalanceDate ? parseISO(digitalWallet.actualBalanceDate) : new Date(0);

        const latestReconDate = new Date(Math.max(primaryReconDate.getTime(), cashReconDate.getTime(), digitalReconDate.getTime()));
        
        reconciliationDate = latestReconDate;
        reconciliationBalance = (primaryAccount?.actualBalance ?? 0) + (cashWallet?.actualBalance ?? 0) + (digitalWallet?.actualBalance ?? 0);
    } else {
        reconciliationBalance = accountPreferences?.actualBalance ?? 0;
        reconciliationDate = accountPreferences?.actualBalanceDate ? parseISO(accountPreferences.actualBalanceDate) : new Date(0);
    }

    const chronologicalTransactions = [...filteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const calculateChange = (t: Transaction) => {
        let amountChange = 0;
        const isInView = (accId?: string) => {
            if (!accId) return false;
            if (isPrimaryView) {
                return accId === accountId || accId === 'cash-wallet' || accId === 'digital-wallet';
            }
            return accId === accountId;
        };

        const loanInfo = getLoanDisplayInfo(t);
        if (loanInfo.isLoan) {
             if (loanInfo.type.includes('Loan Given') || loanInfo.type.includes('Repayment Made')) {
                amountChange = -t.amount;
            } else if (loanInfo.type.includes('Loan from') || loanInfo.type.includes('Loan Taken') || loanInfo.type.includes('Repayment Received')) {
                amountChange = t.amount;
            }
        } else if (t.type === 'income' && isInView(t.accountId)) {
            amountChange = t.amount;
        } else if (t.type === 'expense') {
            const paymentAccId = t.paymentMethod === 'cash' ? 'cash-wallet' : t.paymentMethod === 'digital' ? 'digital-wallet' : t.accountId;
            if (isInView(paymentAccId)) {
                amountChange = -t.amount;
            }
        } else if (t.type === 'transfer') {
            const fromInView = isInView(t.fromAccountId);
            const toInView = isInView(t.toAccountId);
            if (fromInView && !toInView) {
                amountChange = -t.amount;
            } else if (!fromInView && toInView) {
                amountChange = t.amount;
            }
        }
        return amountChange;
    };

    let runningBalance = reconciliationBalance;
    const balanceMap = new Map<string, number>();

    const afterReconTx = chronologicalTransactions.filter(t => isAfter(parseISO(t.date), reconciliationDate) || isSameDay(parseISO(t.date), reconciliationDate));
    const beforeReconTx = chronologicalTransactions.filter(t => isBefore(parseISO(t.date), reconciliationDate));

    afterReconTx.forEach(t => {
      runningBalance += calculateChange(t);
      balanceMap.set(t.id, runningBalance);
    });

    runningBalance = reconciliationBalance;
    beforeReconTx.reverse().forEach(t => {
      balanceMap.set(t.id, runningBalance);
      runningBalance -= calculateChange(t);
    });
    
    return filteredTransactions.map(t => ({
        ...t,
        balance: balanceMap.get(t.id) || 0,
    }));
}, [filteredTransactions, accountId, accounts, loans, fullAccounts]);


  const totalPages = Math.ceil(transactionsWithBalance.length / itemsPerPage);

  const pagedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactionsWithBalance.slice(startIndex, endIndex);
  }, [transactionsWithBalance, currentPage, itemsPerPage]);

   useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(userAccounts);
      });

      const transactionsQuery = query(
        collection(db, "transactions"), 
        where("userId", "==", user.uid)
      );
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        const userTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
        setTransactions(userTransactions);
      });
      
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        const userCategories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        setCategories(userCategories);
      });
      
      const loansQuery = query(collection(db, "loans"), where("userId", "==", user.uid));
      const unsubscribeLoans = onSnapshot(loansQuery, (snapshot) => {
        const userLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
        setLoans(userLoans);
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
        unsubscribeLoans();
      };
    }
  }, [user, db]);

  useEffect(() => {
    if (selectedTransaction) {
      setEditDate(new Date(selectedTransaction.date));
      setEditAmount(String(selectedTransaction.amount));
      if (selectedTransaction.type === 'expense' || selectedTransaction.type === 'income') {
        const categoryDoc = categories.find(c => c.id === selectedTransaction.categoryId);
        setEditCategory(categoryDoc?.id);
      }
    } else {
        setEditDate(undefined);
        setEditCategory(undefined);
        setEditAmount("");
    }
   }, [selectedTransaction, categories]);

   useEffect(() => {
    setCurrentPage(1);
   }, [dateRange, searchQuery, accountId]);
  
  const handleAddTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    
    const formData = new FormData(event.currentTarget);
    const dateString = formData.get("date") as string;
    const transactionDate = dateString ? new Date(dateString) : new Date();
    const transactionType = activeTab;

    try {
        if (transactionType === 'expense' || transactionType === 'income') {
            const amountStr = transactionType === 'expense' ? expenseAmount : incomeAmount;
            const amount = parseFloat(amountStr);
            const accountId = formData.get(`${transactionType}-account`) as string;
            const description = formData.get(`${transactionType}-description`) as string
            const categoryId = formData.get(`${transactionType}-category`) as string;

            if (transactionType === 'expense') {
                if (accountId === 'cash-wallet' && amount > cashWalletBalance) {
                    toast({ variant: "destructive", title: "Insufficient Balance", description: "Insufficient balance in Cash Wallet." });
                    return;
                }
                if (accountId === 'digital-wallet' && amount > digitalWalletBalance) {
                    toast({ variant: "destructive", title: "Insufficient Balance", description: "Insufficient balance in Digital Wallet." });
                    return;
                }
            }

            const newTransaction: Partial<Omit<Transaction, "id">> & { userId: string, type: 'expense' | 'income' } = {
                userId: user.uid,
                description: description,
                amount: amount,
                type: transactionType as 'expense' | 'income',
                date: transactionDate.toISOString(),
                category: "Uncategorized",
                categoryId: categoryId,
                paymentMethod: 'online', // Default
            };

            if (transactionType === 'expense') {
                if (accountId === 'cash-wallet') {
                    newTransaction.paymentMethod = 'cash';
                    delete (newTransaction as Partial<Transaction>).accountId;
                } else if (accountId === 'digital-wallet') {
                    newTransaction.paymentMethod = 'digital';
                    delete (newTransaction as Partial<Transaction>).accountId;
                } else {
                    newTransaction.paymentMethod = 'online';
                    newTransaction.accountId = accountId;
                }
            } else { // Income
                 newTransaction.accountId = accountId;
            }

            if (transactionType === 'expense' || transactionType === 'income') {
              const subcategory = formData.get(`${transactionType}-subcategory`) as string;
              const categoryDoc = categories.find(c => c.id === categoryId);
              newTransaction.category = categoryDoc?.name || 'Uncategorized';
              if (subcategory) {
                  newTransaction.subcategory = subcategory;
              }
            }
            
            await runTransaction(db, async (t) => {
                const newTransactionRef = doc(collection(db, "transactions"));
                t.set(newTransactionRef, newTransaction);
                
                // Bill payment detection logic
                if (newTransaction.type === 'expense') {
                    const billsQuery = query(
                        collection(db, "bills"), 
                        where("userId", "==", user.uid),
                        where("type", "==", "bill") // Only match bills, not special days
                    );
                    const billsSnapshot = await getDocs(billsQuery);
                    
                    for (const billDoc of billsSnapshot.docs) {
                        const bill = { id: billDoc.id, ...billDoc.data() } as Bill;
                        const dueDate = new Date(bill.dueDate);

                        // Match bill if title and amount are similar and it's currently due (not paid or paid before current due date)
                        if (bill.title.toLowerCase() === description.toLowerCase() && 
                            bill.amount === amount &&
                            (!bill.paidOn || isBefore(new Date(bill.paidOn), dueDate)) )
                        {
                            const updateData: { paidOn: string, dueDate?: string } = { paidOn: transactionDate.toISOString() };

                            if (bill.recurrence !== 'none' && bill.recurrence !== 'occasional') {
                                let nextDueDate: Date;
                                switch(bill.recurrence) {
                                    case 'monthly': nextDueDate = addMonths(dueDate, 1); break;
                                    case 'quarterly': nextDueDate = addQuarters(dueDate, 1); break;
                                    case 'yearly': nextDueDate = addYears(dueDate, 1); break;
                                    default: nextDueDate = dueDate;
                                }
                                updateData.dueDate = nextDueDate.toISOString();
                            }
                            
                            t.update(doc(db, "bills", bill.id), updateData);
                            break; // Assume one transaction pays one bill
                        }
                    }
                }
            });

        } else if (transactionType === 'transfer') {
            const amount = parseFloat(transferAmount);
            const fromAccountId = formData.get("transfer-from") as string;
            const toAccountId = formData.get("transfer-to") as string;
            const description = formData.get("transfer-description") as string;

            if (fromAccountId === toAccountId) {
                toast({
                    variant: "destructive",
                    title: "Invalid Transfer",
                    description: "You cannot transfer funds to and from the same account.",
                });
                return;
            }

            const fromAccountName = getAccountName(fromAccountId);
            const toAccountName = getAccountName(toAccountId);

            const newTransaction = {
                userId: user.uid,
                description: description || `Transfer from ${fromAccountName} to ${toAccountName}`,
                amount,
                fromAccountId,
                toAccountId,
                type: 'transfer' as 'transfer',
                date: transactionDate.toISOString(),
                category: 'Transfer',
                paymentMethod: 'online' as 'online', 
                accountId: fromAccountId, 
                categoryId: 'transfer',
            };

            await runTransaction(db, async (t) => {
                const newTransactionRef = doc(collection(db, "transactions"));
                t.set(newTransactionRef, newTransaction);
            });
        }
        
        setIsAddDialogOpen(false);
        setSelectedExpenseCategory(undefined);
        setSelectedIncomeCategory(undefined);
        setDate(new Date());
        setExpenseAmount("");
        setIncomeAmount("");
        setTransferAmount("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transaction Failed",
        description: error.message || "An unexpected error occurred."
      })
    }
  }

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
  
  const getBadgeVariant = (type: Transaction['type']) => {
    switch (type) {
      case 'income':
        return 'default';
      case 'expense':
        return 'destructive';
      case 'transfer':
      default:
        return 'secondary';
    }
  }

  const handlePrint = () => {
    window.print();
  }

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateRange(undefined);
  }

  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);

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


  return (
    <>
    <Card className="print-hide">
      <CardHeader>
        <div className="flex justify-center items-center gap-2">
          {totalPages > 1 && (
            <>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(prev => prev - 1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center justify-center text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        <div className="flex flex-col md:flex-row items-center gap-2 w-full pt-4">
          <div className="relative flex-1 md:grow-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
            />
          </div>
          <div className="flex w-full md:w-auto items-center gap-2">
            <Label htmlFor="from-date" className="text-sm shrink-0">Pick a date range:</Label>
            <Input 
                id="from-date"
                type="date"
                className="w-full"
                value={dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                    const newFromDate = e.target.value ? new Date(e.target.value) : undefined;
                    setDateRange(prev => ({ from: newFromDate, to: prev?.to }))
                }}
            />
             <Label htmlFor="to-date" className="sr-only">To Date</Label>
            <Input 
                id="to-date"
                type="date"
                className="w-full"
                value={dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                    const newToDate = e.target.value ? new Date(e.target.value) : undefined;
                    setDateRange(prev => ({ from: prev?.from, to: newToDate }))
                }}
            />
          </div>
          <Button onClick={handleClearFilters} variant="ghost" size="icon" className="h-10 w-10">
            <XCircle className="h-5 w-5" />
            <span className="sr-only">Clear filters</span>
          </Button>
          <Button onClick={handlePrint} variant="outline" size="icon" className="h-10 w-10">
            <Printer className="h-5 w-5" />
            <span className="sr-only">Print</span>
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setSelectedExpenseCategory(undefined);
              setSelectedIncomeCategory(undefined);
              setDate(new Date());
              setExpenseAmount("");
              setIncomeAmount("");
              setTransferAmount("");
            }
          }}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
                <DialogDescription>
                  Select the type of transaction and fill in the details.
                </DialogDescription>
              </DialogHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="expense">Expense</TabsTrigger>
                  <TabsTrigger value="income">Income</TabsTrigger>
                  <TabsTrigger value="transfer">Transfer</TabsTrigger>
                </TabsList>
                <form onSubmit={handleAddTransaction}>
                  <div className="py-4 space-y-4">
                  <TabsContent value="expense" className="mt-0 space-y-4">
                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="expense-date">Date</Label>
                        <Input id="expense-date" name="date" type="date" defaultValue={format(date || new Date(), 'yyyy-MM-dd')} required />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="expense-description">Description</Label>
                      <Input id="expense-description" name="expense-description" placeholder="e.g. Groceries" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="expense-category">Category</Label>
                            <Select name="expense-category" onValueChange={setSelectedExpenseCategory} value={selectedExpenseCategory}>
                                <SelectTrigger id="expense-category" className="h-auto">
                                    <SelectValue placeholder="Select category" className="whitespace-normal" />
                                </SelectTrigger>
                                  <SelectContent>
                                      {expenseCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                  </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="expense-subcategory">Sub-category</Label>
                            <Select name="expense-subcategory" disabled={!selectedExpenseCategory || expenseSubcategories.length === 0}>
                                <SelectTrigger id="expense-subcategory" className="h-auto">
                                    <SelectValue placeholder="Select sub-category" className="whitespace-normal" />
                                </SelectTrigger>
                                  <SelectContent>
                                      {expenseSubcategories.map(sub => <SelectItem key={sub.name} value={sub.name}>{sub.name}</SelectItem>)}
                                  </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="expense-account">Payment Method</Label>
                          <Select name="expense-account" required defaultValue={primaryAccount?.id}>
                            <SelectTrigger id="expense-account">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash-wallet">
                                    <div className="flex items-center gap-2">
                                        <span>Cash Wallet</span>
                                        <span className="text-muted-foreground">({formatCurrency(cashWalletBalance)})</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="digital-wallet">
                                    <div className="flex items-center gap-2">
                                        <span>Digital Wallet</span>
                                        <span className="text-muted-foreground">({formatCurrency(digitalWalletBalance)})</span>
                                    </div>
                                </SelectItem>
                                {fullAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{acc.name}</span>
                                            <span className="text-muted-foreground">({formatCurrency(acc.balance)})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expense-amount">Amount</Label>
                          <Input
                              id="expense-amount"
                              name="expense-amount"
                              placeholder="e.g. 50+20"
                              required
                              className="hide-number-arrows"
                              value={expenseAmount}
                              onChange={handleAmountChange(setExpenseAmount)}
                              onBlur={() => handleAmountBlur(expenseAmount, setExpenseAmount)}
                          />
                        </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="income" className="mt-0 space-y-4">
                     <div className="space-y-2 col-span-2">
                        <Label htmlFor="income-date">Date</Label>
                         <Input id="income-date" name="date" type="date" defaultValue={format(date || new Date(), 'yyyy-MM-dd')} required />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="income-description">Description</Label>
                      <Input id="income-description" name="income-description" placeholder="e.g. Salary" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="income-category">Category</Label>
                            <Select name="income-category" onValueChange={setSelectedIncomeCategory} value={selectedIncomeCategory}>
                                <SelectTrigger id="income-category" className="h-auto">
                                    <SelectValue placeholder="Select category" className="whitespace-normal" />
                                </SelectTrigger>
                                  <SelectContent>
                                      {incomeCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                  </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="income-subcategory">Sub-category</Label>
                            <Select name="income-subcategory" disabled={!selectedIncomeCategory || incomeSubcategories.length === 0}>
                                <SelectTrigger id="income-subcategory" className="h-auto">
                                    <SelectValue placeholder="Select sub-category" className="whitespace-normal" />
                                </SelectTrigger>
                                  <SelectContent>
                                      {incomeSubcategories.map(sub => <SelectItem key={sub.name} value={sub.name}>{sub.name}</SelectItem>)}
                                  </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="income-account">Bank Account</Label>
                          <Select name="income-account" required defaultValue={primaryAccount?.id}>
                            <SelectTrigger id="income-account">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                                {fullAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                        <div className="flex items-center gap-2">
                                            <span>{acc.name}</span>
                                            <span className="text-muted-foreground">({formatCurrency(acc.balance)})</span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="income-amount">Amount</Label>
                          <Input
                              id="income-amount"
                              name="income-amount"
                              placeholder="e.g. 1000-50"
                              required
                              className="hide-number-arrows"
                              value={incomeAmount}
                              onChange={handleAmountChange(setIncomeAmount)}
                              onBlur={() => handleAmountBlur(incomeAmount, setIncomeAmount)}
                          />
                        </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="transfer" className="mt-0 space-y-4">
                       <div className="space-y-2 col-span-2">
                        <Label htmlFor="transfer-date">Date</Label>
                        <Input id="transfer-date" name="date" type="date" defaultValue={format(date || new Date(), 'yyyy-MM-dd')} required />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="transfer-description">Description</Label>
                      <Input id="transfer-description" name="transfer-description" placeholder="e.g. Monthly rent" />
                    </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="transfer-from">From Account</Label>
                              <Select name="transfer-from" required defaultValue={primaryAccount?.id}>
                                  <SelectTrigger id="transfer-from">
                                      <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                  <SelectContent>
                                        <SelectItem value="cash-wallet">
                                            <div className="flex items-center gap-2">
                                                <span>Cash Wallet</span>
                                                <span className="text-muted-foreground">({formatCurrency(cashWalletBalance)})</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="digital-wallet">
                                            <div className="flex items-center gap-2">
                                                <span>Digital Wallet</span>
                                                <span className="text-muted-foreground">({formatCurrency(digitalWalletBalance)})</span>
                                            </div>
                                        </SelectItem>
                                        {fullAccounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex items-center gap-2">
                                                    <span>{acc.name}</span>
                                                    <span className="text-muted-foreground">({formatCurrency(acc.balance)})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="transfer-to">To Account</Label>
                              <Select name="transfer-to" required>
                                  <SelectTrigger id="transfer-to">
                                      <SelectValue placeholder="Select account" />
                                  </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cash-wallet">
                                            <div className="flex items-center gap-2">
                                                <span>Cash Wallet</span>
                                                <span className="text-muted-foreground">({formatCurrency(cashWalletBalance)})</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="digital-wallet">
                                            <div className="flex items-center gap-2">
                                                <span>Digital Wallet</span>
                                                <span className="text-muted-foreground">({formatCurrency(digitalWalletBalance)})</span>
                                            </div>
                                        </SelectItem>
                                        {fullAccounts.map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>
                                                <div className="flex items-center gap-2">
                                                    <span>{acc.name}</span>
                                                    <span className="text-muted-foreground">({formatCurrency(acc.balance)})</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                              </Select>
                          </div>
                      </div>
                       <div className="space-y-2 col-span-2">
                          <Label htmlFor="transfer-amount">Amount</Label>
                          <Input
                              id="transfer-amount"
                              name="transfer-amount"
                              placeholder="e.g. 500*2"
                              required
                              className="hide-number-arrows"
                              value={transferAmount}
                              onChange={handleAmountChange(setTransferAmount)}
                              onBlur={() => handleAmountBlur(transferAmount, setIncomeAmount)}
                          />
                      </div>
                  </TabsContent>
                  </div>
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Add Transaction</Button>
                  </DialogFooter>
                </form>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
    </Card>
    <Card id="printable-area">
      <CardContent className="p-0">
        <div className="relative overflow-auto max-h-[calc(100vh-350px)]">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                <TableHead>Sl.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[25%]">Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Transfer</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right print-hide">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pagedTransactions.map((t, index) => {
                  const loanInfo = getLoanDisplayInfo(t);
                  return (
                    <TableRow key={t.id} className={loanInfo.colorClass}>
                        <TableCell className="font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                        <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="font-medium" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{loanInfo.description}</TableCell>
                        <TableCell>
                          <Badge 
                              variant={getBadgeVariant(t.type)}
                              className="capitalize"
                              >
                              {loanInfo.type}
                          </Badge>
                        </TableCell>
                        <TableCell style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} -> ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                        <TableCell style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            <div>{loanInfo.category}</div>
                            {t.subcategory && <div className="text-sm text-muted-foreground">{t.subcategory}</div>}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                            {t.type !== 'transfer' ? formatCurrency(t.amount) : null}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", loanInfo.isLoan ? getLoanAmountColor(loanInfo) : 'text-blue-600')}>
                            {t.type === 'transfer' ? formatCurrency(t.amount) : null}
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
                                    <AlertDialogContent onInteractOutside={(e) => e.preventDefault()}>
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
      </CardContent>
    </Card>

    {/* Edit Transaction Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
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
                            <Input id="edit-description" name="description" defaultValue={selectedTransaction?.description} required />
                        </div>
                    

                    {(selectedTransaction?.type === 'expense' || selectedTransaction?.type === 'income') && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-category">Category</Label>
                                <Select name="category" onValueChange={setEditCategory} defaultValue={editCategory}>
                                    <SelectTrigger id="edit-category">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                        <SelectContent>
                                            {categories.filter(c => {
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
                                <Select name="subcategory" defaultValue={selectedTransaction?.subcategory} disabled={!editCategory || editSubcategories.length === 0}>
                                    <SelectTrigger id="edit-subcategory">
                                        <SelectValue placeholder="Select sub-category" />
                                    </SelectTrigger>
                                        <SelectContent>
                                            {editSubcategories.map(sub => <SelectItem key={sub.name} value={sub.name}>{sub.name}</SelectItem>)}
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
                            <Select name="account" required defaultValue={selectedTransaction?.paymentMethod === 'cash' ? 'cash-wallet' : selectedTransaction?.paymentMethod === 'digital' ? 'digital-wallet' : selectedTransaction?.accountId}>
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

    