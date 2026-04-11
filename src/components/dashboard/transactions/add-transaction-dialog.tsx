"use client"

import { useState, useEffect, useMemo, Fragment } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Account, Category, Transaction } from "@/lib/data";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy, writeBatch, doc, updateDoc, deleteField } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/hooks/use-auth-state";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

interface ExpenseItem {
    id: number;
    description: string;
    amount: string;
    categoryId: string;
    subcategory: string;
}

export function AddTransactionDialog({ 
    isOpen, 
    onOpenChange, 
    accounts: accountData, 
    transactionToEdit 
}: { 
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    accounts: (Account | {id: string, name: string, balance: number})[];
    transactionToEdit?: Transaction | null 
}) {
  const [user] = useAuthState();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactionType, setTransactionType] = useState<Transaction["type"]>("expense");
  const { toast } = useToast();
  const isEditMode = !!transactionToEdit;

  // Common state
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expense State
  const initialExpenseItem = { id: Date.now(), description: '', amount: '', categoryId: '', subcategory: '' };
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([initialExpenseItem]);
  const primaryAccount = accountData.find(acc => 'isPrimary' in acc && (acc as Account).isPrimary);
  const postBankAccount = useMemo(() => accountData.find(acc => 'name' in acc && acc.name.toLowerCase().includes('post bank')), [accountData]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<string | undefined>(primaryAccount?.id);
  
  // Income State
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeCategory, setIncomeCategory] = useState<string | undefined>();
  const [incomeSubcategory, setIncomeSubcategory] = useState<string | undefined>();
  const [incomeAccountId, setIncomeAccountId] = useState<string | undefined>(primaryAccount?.id);

  // Transfer State
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [fromAccountId, setFromAccountId] = useState<string | undefined>();
  const [toAccountId, setToAccountId] = useState<string | undefined>();


  useEffect(() => {
    if (user && db) {
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      });
      return () => unsubscribeCategories();
    }
  }, [user, db]);

  const resetForms = () => {
      // Reset common state
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setTransactionType('expense');

      // Reset expense state
      setExpenseItems([initialExpenseItem]);
      setExpensePaymentMethod(primaryAccount?.id);
      
      // Reset income state
      setIncomeAmount("");
      setIncomeDescription("");
      setIncomeCategory(undefined);
      setIncomeSubcategory(undefined);
      setIncomeAccountId(primaryAccount?.id);

      // Reset transfer state
      setTransferAmount("");
      setTransferDescription("");
      setFromAccountId(undefined);
      setToAccountId(undefined);
  }

  useEffect(() => {
    if (isOpen) {
        if (transactionToEdit) {
            setTransactionType(transactionToEdit.type);
            setDate(format(new Date(transactionToEdit.date), 'yyyy-MM-dd'));
            if (transactionToEdit.type === 'expense') {
                const items = transactionToEdit.items && transactionToEdit.items.length > 0
                    ? transactionToEdit.items.map((item, index) => ({
                        id: Date.now() + index,
                        description: item.description,
                        amount: String(item.amount),
                        categoryId: item.categoryId || categories.find(c => c.name === item.category && (c.type === 'expense' || c.type === 'bank-expense'))?.id || '',
                        subcategory: item.subcategory || ''
                    }))
                    : [{ 
                        id: Date.now(), 
                        description: transactionToEdit.description, 
                        amount: String(transactionToEdit.amount), 
                        categoryId: transactionToEdit.categoryId || '', 
                        subcategory: transactionToEdit.subcategory || ''
                    }];
                setExpenseItems(items);
                const paymentAccountId = transactionToEdit.paymentMethod === 'cash' ? 'cash-wallet' : transactionToEdit.paymentMethod === 'digital' ? 'digital-wallet' : transactionToEdit.accountId;
                setExpensePaymentMethod(paymentAccountId);
            } else if (transactionToEdit.type === 'income') {
                setIncomeAmount(String(transactionToEdit.amount));
                setIncomeDescription(transactionToEdit.description);
                setIncomeCategory(transactionToEdit.categoryId);
                setIncomeSubcategory(transactionToEdit.subcategory);
                setIncomeAccountId(transactionToEdit.accountId);
            } else if (transactionToEdit.type === 'transfer') {
                setTransferAmount(String(transactionToEdit.amount));
                setTransferDescription(transactionToEdit.description);
                setFromAccountId(transactionToEdit.fromAccountId);
                setToAccountId(transactionToEdit.toAccountId);
            }
        } else {
            resetForms();
        }
    }
  }, [isOpen, transactionToEdit, categories]);


  // --- Expense Form Handlers ---
  const handleExpenseItemChange = (index: number, field: keyof ExpenseItem, value: string) => {
    const newItems = [...expenseItems];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'categoryId') {
        newItems[index].subcategory = ''; // Reset subcategory when category changes
    }
    setExpenseItems(newItems);
  };

  const addExpenseItem = () => {
    setExpenseItems([...expenseItems, { id: Date.now(), description: '', amount: '', categoryId: '', subcategory: '' }]);
  };

  const removeExpenseItem = (index: number) => {
    if (expenseItems.length > 1) {
      setExpenseItems(expenseItems.filter((_, i) => i !== index));
    }
  };

  const handleExpenseAmountBlur = (index: number) => {
    const item = expenseItems[index];
    if (item.amount.trim() === "") return;
    const result = evaluateMath(item.amount);
    if (result !== null) {
      handleExpenseItemChange(index, 'amount', String(result));
    }
  };

  const totalExpenseAmount = useMemo(() => {
    return expenseItems.reduce((total, item) => {
      const amount = parseFloat(item.amount);
      return total + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [expenseItems]);

  const expenseSubcategories = (categoryId: string) => {
    if (!categoryId) return [];
    return categories.find(c => c.id === categoryId)?.subcategories || [];
  };

  const expenseCategoriesForDropdown = useMemo(() => {
    const expenseCats = categories.filter(c => c.type === 'expense');
    const bankExpenseCats = categories.filter(c => c.type === 'bank-expense');
    const isPostBankSelected = expensePaymentMethod === postBankAccount?.id;

    let allCats;
    if (isPostBankSelected) {
        const incomeCats = categories.filter(c => c.type === 'income');
        const combined = [...incomeCats, ...expenseCats, ...bankExpenseCats];
        allCats = Array.from(new Map(combined.map(item => [item.id, item])).values());
    } else {
        allCats = [...expenseCats, ...bankExpenseCats];
    }
    
    return allCats.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aIsSpecial = aName.includes('hdfc bank') || aName.includes('post bank');
        const bIsSpecial = bName.includes('hdfc bank') || bName.includes('post bank');

        if (aIsSpecial && !bIsSpecial) {
            return 1; // a goes after b
        }
        if (!aIsSpecial && bIsSpecial) {
            return -1; // a goes before b
        }
        // If both are special or both are not, sort by original order
        return (a.order || 0) - (b.order || 0);
    });
  }, [categories, expensePaymentMethod, postBankAccount]);

  // --- Income Form Handlers ---
  const incomeSubcategories = useMemo(() => {
    if (!incomeCategory) return [];
    return categories.find(c => c.id === incomeCategory)?.subcategories || [];
  }, [incomeCategory, categories]);

  const incomeDropdownCategories = useMemo(() => {
    return categories.filter(c => c.type === 'income');
  }, [categories]);
  
  const handleIncomeAmountBlur = () => {
    if (incomeAmount.trim() === "") return;
    const result = evaluateMath(incomeAmount);
    if (result !== null) setIncomeAmount(String(result));
  };

  // --- Transfer Form Handlers ---
  const handleTransferAmountBlur = () => {
    if (transferAmount.trim() === "") return;
    const result = evaluateMath(transferAmount);
    if (result !== null) setTransferAmount(String(result));
  };
  
  // --- SUBMIT ---
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
    setIsSubmitting(true);

    const transactionDate = date ? new Date(date) : new Date();
    const timezoneOffset = transactionDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(transactionDate.getTime() + timezoneOffset);

    try {
        if (transactionType === 'expense') {
            const validItems = expenseItems.filter(item => item.description && parseFloat(item.amount) > 0);
            if (validItems.length === 0) throw new Error("No valid expense items to save.");
            
            const totalAmount = validItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
            const firstItem = validItems[0];
            const categoryDoc = categories.find(c => c.id === firstItem.categoryId);
        
            const transactionData: any = {
                userId: user.uid,
                date: adjustedDate.toISOString(),
                amount: totalAmount,
                type: 'expense',
                description: firstItem.description,
                category: categoryDoc?.name || 'Uncategorized',
                categoryId: firstItem.categoryId || "",
                subcategory: firstItem.subcategory || "",
            };
        
            if (expensePaymentMethod === 'cash-wallet') {
                transactionData.paymentMethod = 'cash';
                // Note: accountId is left off to avoid Firestore 'undefined' validation error
            } else if (expensePaymentMethod === 'digital-wallet') {
                transactionData.paymentMethod = 'digital';
                // Note: accountId is left off
            } else {
                transactionData.paymentMethod = 'online';
                transactionData.accountId = expensePaymentMethod;
            }

            if(isEditMode) {
                const txRef = doc(db, "transactions", transactionToEdit.id);
                
                // For updates, handle explicit removal of accountId if switched to wallet
                if (expensePaymentMethod === 'cash-wallet' || expensePaymentMethod === 'digital-wallet') {
                    transactionData.accountId = deleteField();
                }

                if (validItems.length > 1) {
                    transactionData.items = validItems.map(item => {
                        const catDoc = categories.find(c => c.id === item.categoryId);
                        return {
                            description: item.description,
                            amount: parseFloat(item.amount),
                            categoryId: item.categoryId,
                            category: catDoc?.name || 'Uncategorized',
                            subcategory: item.subcategory,
                        };
                    });
                } else {
                    transactionData.items = deleteField();
                }
                await updateDoc(txRef, transactionData);
                toast({ title: `Expense updated.` });
            } else {
                if (validItems.length > 1) {
                    transactionData.items = validItems.map(item => {
                        const catDoc = categories.find(c => c.id === item.categoryId);
                        return {
                            description: item.description,
                            amount: parseFloat(item.amount),
                            categoryId: item.categoryId,
                            category: catDoc?.name || 'Uncategorized',
                            subcategory: item.subcategory,
                        };
                    });
                }
                await addDoc(collection(db, "transactions"), transactionData);
                toast({ title: `Expense added.` });
            }

        } else if (transactionType === 'income') {
            const categoryDoc = categories.find(c => c.id === incomeCategory);
            const transactionData: any = {
                userId: user.uid,
                date: adjustedDate.toISOString(),
                description: incomeDescription,
                amount: parseFloat(incomeAmount),
                type: 'income',
                category: categoryDoc?.name || 'Uncategorized',
                categoryId: incomeCategory,
                subcategory: incomeSubcategory || "",
                paymentMethod: 'online',
                accountId: incomeAccountId,
            };
            if(isEditMode) {
                const txRef = doc(db, "transactions", transactionToEdit.id);
                await updateDoc(txRef, transactionData);
                toast({ title: `Income updated.` });
            } else {
                await addDoc(collection(db, "transactions"), transactionData);
                toast({ title: "Income added successfully." });
            }

        } else if (transactionType === 'transfer') {
             if (fromAccountId === toAccountId) {
                throw new Error("From and To accounts cannot be the same.");
            }
            const transactionData: any = {
                userId: user.uid,
                date: adjustedDate.toISOString(),
                description: transferDescription,
                amount: parseFloat(transferAmount),
                type: 'transfer',
                fromAccountId: fromAccountId,
                toAccountId: toAccountId,
            };
            if(isEditMode) {
                const txRef = doc(db, "transactions", transactionToEdit.id);
                await updateDoc(txRef, transactionData);
                toast({ title: `Transfer updated.` });
            } else {
                await addDoc(collection(db, "transactions"), transactionData);
                toast({ title: "Transfer recorded successfully." });
            }
        }

        onOpenChange(false);

    } catch (error: any) {
        toast({ variant: "destructive", title: "Submission Failed", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  };

  const bankAccounts = accountData.filter(acc => acc.id !== 'cash-wallet' && acc.id !== 'digital-wallet');

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit' : 'Add New'} Transaction</DialogTitle>
          <DialogDescription>Record a new income, expense, or transfer.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <Tabs value={transactionType} onValueChange={(value) => setTransactionType(value as Transaction['type'])}>
            <TabsList className={cn("grid w-full grid-cols-3", isEditMode && "hidden")}>
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
            </TabsList>
            
            <div className="py-4">
              <TabsContent value="expense" className="mt-0 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="date-expense">Date</Label>
                        <Input id="date-expense" name="date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-white dark:bg-card"/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="account-expense">Payment Method</Label>
                        <Select name="account" required value={expensePaymentMethod} onValueChange={setExpensePaymentMethod}>
                            <SelectTrigger id="account-expense" className="bg-white dark:bg-card"><SelectValue placeholder="Select method" /></SelectTrigger>
                            <SelectContent>
                                {accountData.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                  </div>

                  <div className="max-h-[20rem] overflow-y-auto pr-2 space-y-3 -mr-2">
                    {expenseItems.map((item, index) => (
                        <div key={item.id} className="relative p-2 border-b">
                            <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-end">
                                <div className="col-span-12 sm:col-span-4 md:col-span-3 space-y-1">
                                    <Label htmlFor={`description-expense-${index}`} className="text-xs font-medium">Description</Label>
                                    <Textarea rows={1} id={`description-expense-${index}`} value={item.description} onChange={(e) => handleExpenseItemChange(index, 'description', e.target.value)} placeholder="e.g. Milk" required className="text-sm bg-white dark:bg-input"/>
                                </div>
                                <div className="col-span-6 sm:col-span-3 md:col-span-2 space-y-1">
                                    <Label htmlFor={`amount-expense-${index}`} className="text-xs font-medium">Amount</Label>
                                    <Input id={`amount-expense-${index}`} value={item.amount} onChange={(e) => handleExpenseItemChange(index, 'amount', e.target.value)} onBlur={() => handleExpenseAmountBlur(index)} placeholder="e.g. 50" required className="hide-number-arrows text-sm bg-white dark:bg-input"/>
                                </div>
                                <div className="col-span-6 sm:col-span-5 md:col-span-3 space-y-1">
                                    <Label htmlFor={`category-expense-${index}`} className="text-xs font-medium">Category</Label>
                                    <Select value={item.categoryId} onValueChange={(value) => handleExpenseItemChange(index, 'categoryId', value)}>
                                        <SelectTrigger id={`category-expense-${index}`} className="text-sm bg-white dark:bg-input"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            {expenseCategoriesForDropdown.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-10 sm:col-span-11 md:col-span-3 space-y-1">
                                    <Label htmlFor={`subcategory-expense-${index}`} className="text-xs font-medium">Sub-category</Label>
                                    <Select value={item.subcategory} onValueChange={(value) => handleExpenseItemChange(index, 'subcategory', value)} disabled={!item.categoryId || expenseSubcategories(item.categoryId).length === 0}>
                                        <SelectTrigger id={`subcategory-expense-${index}`} className="text-sm bg-white dark:bg-input"><SelectValue placeholder="Select" /></SelectTrigger>
                                        <SelectContent>
                                            {expenseSubcategories(item.categoryId).map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1">
                                    {expenseItems.length > 1 && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Remove Item?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Are you sure you want to remove "{item.description || 'this item'}" from the transaction?
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => removeExpenseItem(index)} className="bg-destructive hover:bg-destructive/90">
                                                        Remove
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                    {index === expenseItems.length - 1 && (
                                      <Button type="button" variant="ghost" size="icon" onClick={addExpenseItem} className="h-9 w-9">
                                          <Plus className="h-4 w-4" />
                                      </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                  </div>

                  <div className="flex justify-end items-center pt-2">
                    <div className="font-bold text-lg text-right">
                        Total: {formatCurrency(totalExpenseAmount)}
                    </div>
                  </div>
              </TabsContent>

              <TabsContent value="income" className="mt-0 space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-income">Date</Label>
                            <Input id="date-income" name="date-income" type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-white dark:bg-input"/>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="account-income">Bank Account</Label>
                          <Select value={incomeAccountId} onValueChange={setIncomeAccountId} required>
                              <SelectTrigger id="account-income" className="bg-white dark:bg-input"><SelectValue placeholder="Select account" /></SelectTrigger>
                              <SelectContent>
                                  {bankAccounts.map(acc => (
                                      <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="description-income">Description</Label>
                            <Textarea id="description-income" value={incomeDescription} onChange={(e) => setIncomeDescription(e.target.value)} placeholder="e.g. Monthly Salary" required className="bg-white dark:bg-input" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-income">Amount</Label>
                            <Input id="amount-income" value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} onBlur={handleIncomeAmountBlur} placeholder="e.g. 50000" required className="hide-number-arrows bg-white dark:bg-input"/>
                        </div>
                    </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="category-income">Category</Label>
                          <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                              <SelectTrigger id="category-income" className="bg-white dark:bg-input"><SelectValue placeholder="Select category" /></SelectTrigger>
                              <SelectContent>
                                  {incomeDropdownCategories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="subcategory-income">Sub-category</Label>
                          <Select value={incomeSubcategory} onValueChange={setIncomeSubcategory} disabled={!incomeCategory || incomeSubcategories.length === 0}>
                              <SelectTrigger id="subcategory-income" className="bg-white dark:bg-input"><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                              <SelectContent>
                                  {incomeSubcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </TabsContent>

              <TabsContent value="transfer" className="mt-0 space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-transfer">Date</Label>
                            <Input id="date-transfer" name="date-transfer" type="date" value={date} onChange={e => setDate(e.target.value)} required className="bg-white dark:bg-input"/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="description-transfer">Description</Label>
                            <Textarea id="description-transfer" value={transferDescription} onChange={(e) => setTransferDescription(e.target.value)} placeholder="e.g. Move to savings" className="bg-white dark:bg-input" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-transfer">Amount</Label>
                            <Input id="amount-transfer" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} onBlur={handleTransferAmountBlur} placeholder="e.g. 1000" required className="hide-number-arrows bg-white dark:bg-input"/>
                        </div>
                   </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="fromAccount-transfer">From</Label>
                          <Select value={fromAccountId} onValueChange={setFromAccountId} required>
                              <SelectTrigger id="fromAccount-transfer" className="bg-white dark:bg-input"><SelectValue placeholder="From..." /></SelectTrigger>
                              <SelectContent>
                                  {accountData.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="toAccount-transfer">To</Label>
                          <Select value={toAccountId} onValueChange={setToAccountId} required>
                              <SelectTrigger id="toAccount-transfer" className="bg-white dark:bg-input"><SelectValue placeholder="To..." /></SelectTrigger>
                              <SelectContent>
                                  {accountData.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance)})</SelectItem>)}
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary" disabled={isSubmitting}>Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting}>{isEditMode ? 'Save Changes' : 'Add Transaction'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
