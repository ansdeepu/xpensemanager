
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
import type { Transaction, Account, Category, Bill } from "@/lib/data";
import { PlusCircle, Pencil, Trash2, CalendarIcon, Printer, Search } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, runTransaction, orderBy, deleteDoc, getDoc, getDocs, limit, writeBatch, updateDoc } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, addMonths, addQuarters, addYears, isAfter, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function TransactionTable({
  accountId,
  isPrimaryView,
}: {
  accountId: string;
  isPrimaryView: boolean;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [user] = useAuthState(auth);
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

  const expenseCategories = useMemo(() => {
    const regularExpenses = categories.filter(c => c.type === 'expense');
    const bankExpenses = categories.filter(c => c.type === 'bank-expense');
    return [...regularExpenses, ...bankExpenses];
  }, [categories]);

  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);

  const { cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    let cash = 0;
    let digital = 0;
    transactions.forEach((t) => {
      if (t.type === 'transfer') {
        if (t.toAccountId === 'cash-wallet') cash += t.amount;
        if (t.fromAccountId === 'cash-wallet') cash -= t.amount;
        if (t.toAccountId === 'digital-wallet') digital += t.amount;
        if (t.fromAccountId === 'digital-wallet') digital -= t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'cash') cash -= t.amount;
        if (t.paymentMethod === 'digital') digital -= t.amount;
      }
    });
    return { cashWalletBalance: cash, digitalWalletBalance: digital };
  }, [transactions]);


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

  const filteredTransactions = useMemo(() => {
    let relevantTransactions;

    if (isPrimaryView) {
      const primaryAndWallets = [accountId, 'cash-wallet', 'digital-wallet'];
      relevantTransactions = transactions.filter(t => {
        // Direct income/expense for the primary account
        if (t.accountId === accountId) return true;
        // Expenses paid via wallets
        if (t.paymentMethod === 'cash' || t.paymentMethod === 'digital') return true;
        // Transfers involving any of the primary group
        if (t.type === 'transfer') {
           return primaryAndWallets.includes(t.fromAccountId!) || primaryAndWallets.includes(t.toAccountId!);
        }
        return false;
      });
    } else {
      // For other account views, only show transactions for that specific account.
      relevantTransactions = transactions.filter(t =>
          t.accountId === accountId || t.fromAccountId === accountId || t.toAccountId === accountId
      );
    }

    let filtered = [...relevantTransactions];

    if (dateRange?.from && dateRange?.to) {
        const interval = { start: startOfDay(dateRange.from), end: endOfDay(dateRange.to) };
        filtered = filtered.filter(t => isWithinInterval(new Date(t.date), interval));
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(t => 
            t.description.toLowerCase().includes(lowercasedQuery) ||
            t.category.toLowerCase().includes(lowercasedQuery) ||
            (t.subcategory && t.subcategory.toLowerCase().includes(lowercasedQuery))
        );
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, accountId, isPrimaryView, dateRange, searchQuery]);


  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const pagedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage, itemsPerPage]);

   useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
        setAccounts(userAccounts);
      });

      const transactionsQuery = query(
        collection(db, "transactions"), 
        where("userId", "==", user.uid), 
        orderBy("date", "desc")
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

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribeCategories();
      };
    }
  }, [user, db]);

  useEffect(() => {
    if (selectedTransaction) {
      setEditDate(new Date(selectedTransaction.date));
      if (selectedTransaction.type === 'expense' || selectedTransaction.type === 'income') {
        const categoryDoc = categories.find(c => c.id === selectedTransaction.categoryId);
        setEditCategory(categoryDoc?.id);
      }
    } else {
        setEditDate(undefined);
        setEditCategory(undefined);
    }
   }, [selectedTransaction, categories]);

   useEffect(() => {
    setCurrentPage(1);
   }, [dateRange, searchQuery, accountId]);

  const getAccountName = (accountId?: string, paymentMethod?: Transaction['paymentMethod']) => {
    if (accountId === 'cash-wallet' || paymentMethod === 'cash') return "Cash Wallet";
    if (accountId === 'digital-wallet' || paymentMethod === 'digital') return "Digital Wallet";
    if (!accountId) return "-";
    return accounts.find((a) => a.id === accountId)?.name || "N/A";
  };
  
  const handleAddTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    
    const formData = new FormData(event.currentTarget);
    const transactionDate = date || new Date();
    const transactionType = activeTab;

    try {
        if (transactionType === 'expense' || transactionType === 'income') {
            const amount = parseFloat(formData.get(`${transactionType}-amount`) as string);
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
                    delete newTransaction.accountId;
                } else if (accountId === 'digital-wallet') {
                    newTransaction.paymentMethod = 'digital';
                    delete newTransaction.accountId;
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
                        where("userId", "==", user.uid)
                    );
                    const billsSnapshot = await getDocs(billsQuery);
                    
                    for (const billDoc of billsSnapshot.docs) {
                        const bill = { id: billDoc.id, ...billDoc.data() } as Bill;
                        const dueDate = new Date(bill.dueDate);

                        // Match bill if title and amount are similar and it's not already paid for this cycle.
                        if (bill.title.toLowerCase() === description.toLowerCase() && 
                            bill.amount === amount &&
                            (!bill.paidOn || !isAfter(new Date(bill.paidOn), dueDate)) )
                        {
                            const updateData: { paidOn: string, dueDate?: string } = { paidOn: transactionDate.toISOString() };

                            if (bill.recurrence !== 'none') {
                                let nextDueDate: Date;
                                switch(bill.recurrence) {
                                    case 'monthly': nextDueDate = addMonths(dueDate, 1); break;
                                    case 'quarterly': nextDueDate = addQuarters(dueDate, 1); break;
                                    case 'yearly': nextDueDate = addYears(dueDate, 1); break;
                                    default: nextDueDate = dueDate;
                                }
                                updateData.dueDate = nextDueDate.toISOString();
                                // For recurring bills, we also need to clear paidOn for the next cycle,
                                // but we do that when displaying, not here.
                            }
                            
                            t.update(doc(db, "bills", bill.id), updateData);
                            break; // Assume one transaction pays one bill
                        }
                    }
                }
            });

        } else if (transactionType === 'transfer') {
            const amount = parseFloat(formData.get("transfer-amount") as string);
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
                type: 'transfer',
                date: transactionDate.toISOString(),
                category: 'Transfer',
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
    const updatedData: Partial<Transaction> = {
      description: formData.get("description") as string,
      amount: parseFloat(formData.get("amount") as string),
      date: (editDate || new Date()).toISOString(),
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
    } catch (error) {
    }
  };


  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, "transactions", transaction.id));
    } catch (error) {
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

  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);

  return (
    <>
    <Card id="printable-area">
      <CardHeader className="flex flex-col gap-4">
         <div className="flex-1">
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            A detailed record of your financial activities.
          </CardDescription>
        </div>
        <div className="flex flex-col md:flex-row items-center gap-2 w-full print-hide">
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
          <Popover>
            <PopoverTrigger asChild>
                <Button
                id="date"
                variant={"outline"}
                className={cn(
                    "w-full md:w-[300px] justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                    dateRange.to ? (
                    <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                    </>
                    ) : (
                    format(dateRange.from, "LLL dd, y")
                    )
                ) : (
                    <span>Pick a date range</span>
                )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                />
            </PopoverContent>
          </Popover>
          <Button onClick={handlePrint} variant="outline" disabled={!dateRange}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) {
              setSelectedExpenseCategory(undefined);
              setSelectedIncomeCategory(undefined);
              setDate(new Date());
            }
          }}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogPortal>
              <DialogContent className="sm:max-w-md">
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
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                  variant={"outline"}
                                  className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !date && "text-muted-foreground"
                                  )}
                                  >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <Calendar
                                  mode="single"
                                  selected={date}
                                  onSelect={setDate}
                                  initialFocus
                                  />
                              </PopoverContent>
                          </Popover>
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
                                  <SelectItem value="cash-wallet">Cash Wallet ({formatCurrency(cashWalletBalance)})</SelectItem>
                                  <SelectItem value="digital-wallet">Digital Wallet ({formatCurrency(digitalWalletBalance)})</SelectItem>
                                  {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="expense-amount">Amount</Label>
                            <Input id="expense-amount" name="expense-amount" type="number" step="0.01" placeholder="0.00" required className="hide-number-arrows"/>
                          </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="income" className="mt-0 space-y-4">
                       <div className="space-y-2 col-span-2">
                          <Label htmlFor="income-date">Date</Label>
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                  variant={"outline"}
                                  className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !date && "text-muted-foreground"
                                  )}
                                  >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <Calendar
                                  mode="single"
                                  selected={date}
                                  onSelect={setDate}
                                  initialFocus
                                  />
                              </PopoverContent>
                          </Popover>
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
                                {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="income-amount">Amount</Label>
                            <Input id="income-amount" name="income-amount" type="number" step="0.01" placeholder="0.00" required className="hide-number-arrows"/>
                          </div>
                      </div>
                    </TabsContent>
                    <TabsContent value="transfer" className="mt-0 space-y-4">
                         <div className="space-y-2 col-span-2">
                          <Label htmlFor="transfer-date">Date</Label>
                          <Popover>
                              <PopoverTrigger asChild>
                                  <Button
                                  variant={"outline"}
                                  className={cn(
                                      "w-full justify-start text-left font-normal",
                                      !date && "text-muted-foreground"
                                  )}
                                  >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                                  </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                  <Calendar
                                  mode="single"
                                  selected={date}
                                  onSelect={setDate}
                                  initialFocus
                                  />
                              </PopoverContent>
                          </Popover>
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
                                        <SelectItem value="cash-wallet">Cash Wallet ({formatCurrency(cashWalletBalance)})</SelectItem>
                                        <SelectItem value="digital-wallet">Digital Wallet ({formatCurrency(digitalWalletBalance)})</SelectItem>
                                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
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
                                        <SelectItem value="cash-wallet">Cash Wallet</SelectItem>
                                        <SelectItem value="digital-wallet">Digital Wallet</SelectItem>
                                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                         <div className="space-y-2 col-span-2">
                            <Label htmlFor="transfer-amount">Amount</Label>
                            <Input id="transfer-amount" name="transfer-amount" type="number" step="0.01" placeholder="0.00" required className="hide-number-arrows"/>
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
            </DialogPortal>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Sl.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[25%]">Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Transfer</TableHead>
                <TableHead className="text-right print-hide">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {pagedTransactions.map((t, index) => (
                    <TableRow key={t.id}>
                        <TableCell className="font-medium">{(currentPage - 1) * itemsPerPage + index + 1}</TableCell>
                        <TableCell>{format(new Date(t.date), 'dd/MM/yy')}</TableCell>
                        <TableCell className="font-medium break-words whitespace-pre-wrap">{t.description}</TableCell>
                        <TableCell>
                        <Badge 
                            variant={getBadgeVariant(t.type)}
                            className="capitalize"
                            >
                            {t.type}
                        </Badge>
                        </TableCell>
                        <TableCell className="break-words">{t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} -> ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod)}</TableCell>
                        <TableCell className="break-words">
                            <div>{t.category}</div>
                            {t.subcategory && <div className="text-sm text-muted-foreground">{t.subcategory}</div>}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", t.type === 'income' ? 'text-green-600' : 'text-red-600')}>
                            {t.type !== 'transfer' ? formatCurrency(t.amount) : null}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                             {t.type === 'transfer' ? formatCurrency(t.amount) : null}
                        </TableCell>
                        <TableCell className="text-right print-hide">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(t)} className="mr-2">
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex justify-center items-center gap-4 print-hide">
            <Button 
                onClick={() => setCurrentPage(prev => prev - 1)} 
                disabled={currentPage === 1}
                variant="outline"
            >
                Previous
            </Button>
            <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
            </span>
            <Button 
                onClick={() => setCurrentPage(prev => prev + 1)} 
                disabled={currentPage === totalPages}
                variant="outline"
            >
                Next
            </Button>
        </CardFooter>
      )}
    </Card>

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
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !editDate && "text-muted-foreground"
                                )}
                                >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {editDate ? format(editDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                mode="single"
                                selected={editDate}
                                onSelect={setEditDate}
                                initialFocus
                                />
                            </PopoverContent>
                        </Popover>
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
                                        <SelectItem value="cash-wallet">Cash Wallet ({formatCurrency(cashWalletBalance)})</SelectItem>
                                        <SelectItem value="digital-wallet">Digital Wallet ({formatCurrency(digitalWalletBalance)})</SelectItem>
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
                                      <SelectItem value="cash-wallet">Cash Wallet ({formatCurrency(cashWalletBalance)})</SelectItem>
                                      <SelectItem value="digital-wallet">Digital Wallet ({formatCurrency(digitalWalletBalance)})</SelectItem>
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
                        <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={selectedTransaction?.amount} required className="hide-number-arrows"/>
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

    