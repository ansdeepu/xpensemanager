"use client"

import { useState, useEffect, useMemo } from "react";
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
import { PlusCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuthState } from "@/hooks/use-auth-state";

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


export function AddTransactionDialog({ children, accounts: accountData }: { children: React.ReactNode, accounts: (Account | {id: string, name: string, balance: number})[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [user] = useAuthState();
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactionType, setTransactionType] = useState<Transaction["type"]>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

  const primaryAccount = accountData.find(acc => 'isPrimary' in acc && (acc as Account).isPrimary);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value);
  };
  
  const handleAmountBlur = () => {
    if (amount.trim() === "") return;
    const result = evaluateMath(amount);
    if (result !== null) {
      setAmount(String(result));
    }
  };
  
  const subcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const category = categories.find(c => c.id === selectedCategory);
    return category?.subcategories || [];
  }, [selectedCategory, categories]);

  useEffect(() => {
    if (user && db) {
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        const userCategories = snapshot.docs.map(doc => {
            const data = doc.data();
            const subcategoriesFromData = Array.isArray(data.subcategories)
                ? data.subcategories.sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                : [];
            return {
                id: doc.id,
                ...data,
                subcategories: subcategoriesFromData,
            } as Category;
        });
        setCategories(userCategories);
      });

      return () => {
        unsubscribeCategories();
      };
    }
  }, [user, db]);

  const handleAddTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const formData = new FormData(event.currentTarget);
    const dateString = formData.get("date") as string;
    const transactionDate = dateString ? new Date(dateString) : new Date();
    
    // Timezone adjustment
    const timezoneOffset = transactionDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(transactionDate.getTime() + timezoneOffset);

    const newTransaction: Partial<Transaction> = {
      userId: user.uid,
      date: adjustedDate.toISOString(),
      description: formData.get("description") as string,
      amount: parseFloat(amount),
      type: transactionType,
    };

    if (transactionType === 'expense' || transactionType === 'income') {
      const categoryId = formData.get('category') as string;
      const subcategory = formData.get('subcategory') as string;
      const categoryDoc = categories.find(c => c.id === categoryId);
      
      newTransaction.category = categoryDoc?.name || 'Uncategorized';
      newTransaction.categoryId = categoryId;
      newTransaction.subcategory = subcategory || "";
      
      const accountId = formData.get("account") as string;
      if (transactionType === 'expense') {
        if (accountId === 'cash-wallet') {
          newTransaction.paymentMethod = 'cash';
        } else if (accountId === 'digital-wallet') {
          newTransaction.paymentMethod = 'digital';
        } else {
          newTransaction.paymentMethod = 'online';
          newTransaction.accountId = accountId;
        }
      } else { // Income
        newTransaction.paymentMethod = 'online';
        newTransaction.accountId = accountId;
      }

    } else if (transactionType === 'transfer') {
      newTransaction.fromAccountId = formData.get("fromAccount") as string;
      newTransaction.toAccountId = formData.get("toAccount") as string;
      if (newTransaction.fromAccountId === newTransaction.toAccountId) {
        toast({
          variant: "destructive",
          title: "Invalid Transfer",
          description: "From and To accounts cannot be the same.",
        });
        return;
      }
    }

    try {
      await addDoc(collection(db, "transactions"), newTransaction);
      setIsOpen(false);
      setAmount(""); // Reset amount
      toast({
        title: "Transaction Added",
        description: "Your transaction has been successfully recorded.",
      });
    } catch (error) {
    }
  };

  const bankAccounts = accountData.filter(acc => acc.id !== 'cash-wallet' && acc.id !== 'digital-wallet');


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add New Transaction</DialogTitle>
          <DialogDescription>
            Record a new income, expense, or transfer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddTransaction}>
          <Tabs value={transactionType} onValueChange={(value) => setTransactionType(value as Transaction['type'])}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="expense">Expense</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="transfer">Transfer</TabsTrigger>
            </TabsList>
            <div className="py-4">
                <TabsContent value="expense" className="mt-0">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-expense">Date</Label>
                            <Input id="date-expense" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description-expense">Description</Label>
                            <Input id="description-expense" name="description" placeholder="e.g. Groceries" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category-expense">Category</Label>
                            <Select name="category" onValueChange={setSelectedCategory}>
                                <SelectTrigger id="category-expense"><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    {categories.filter(c => c.type === 'expense' || c.type === 'bank-expense').map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subcategory-expense">Sub-category</Label>
                            <Select name="subcategory" disabled={!selectedCategory || subcategories.length === 0}>
                                <SelectTrigger id="subcategory-expense"><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                                <SelectContent>
                                    {subcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="account-expense">Payment Method</Label>
                            <Select name="account" required defaultValue={primaryAccount?.id}>
                                <SelectTrigger id="account-expense"><SelectValue placeholder="Select method" /></SelectTrigger>
                                <SelectContent>
                                    {accountData.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name} ({formatCurrency(acc.balance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-expense">Amount</Label>
                            <Input id="amount-expense" name="amount" placeholder="e.g. 500 or 100+50" required className="hide-number-arrows" value={amount} onChange={handleAmountChange} onBlur={handleAmountBlur}/>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="income" className="mt-0">
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-income">Date</Label>
                            <Input id="date-income" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description-income">Description</Label>
                            <Input id="description-income" name="description" placeholder="e.g. Monthly Salary" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category-income">Category</Label>
                            <Select name="category" onValueChange={setSelectedCategory}>
                                <SelectTrigger id="category-income"><SelectValue placeholder="Select category" /></SelectTrigger>
                                <SelectContent>
                                    {categories.filter(c => c.type === 'income').map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subcategory-income">Sub-category</Label>
                            <Select name="subcategory" disabled={!selectedCategory || subcategories.length === 0}>
                                <SelectTrigger id="subcategory-income"><SelectValue placeholder="Select sub-category" /></SelectTrigger>
                                <SelectContent>
                                    {subcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="account-income">Bank Account</Label>
                            <Select name="account" required defaultValue={primaryAccount?.id}>
                                <SelectTrigger id="account-income"><SelectValue placeholder="Select account" /></SelectTrigger>
                                <SelectContent>
                                    {bankAccounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name} ({formatCurrency(acc.balance)})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-income">Amount</Label>
                            <Input id="amount-income" name="amount" placeholder="e.g. 50000" required className="hide-number-arrows" value={amount} onChange={handleAmountChange} onBlur={handleAmountBlur}/>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="transfer" className="mt-0">
                     <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="date-transfer">Date</Label>
                            <Input id="date-transfer" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description-transfer">Description</Label>
                            <Input id="description-transfer" name="description" placeholder="e.g. Move to savings" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fromAccount-transfer">From</Label>
                            <Select name="fromAccount" required>
                                <SelectTrigger id="fromAccount-transfer"><SelectValue placeholder="From..." /></SelectTrigger>
                                <SelectContent>
                                    {accountData.map(acc => (
                                      <SelectItem key={acc.id} value={acc.id}>
                                        {acc.name} ({formatCurrency(acc.balance)})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="toAccount-transfer">To</Label>
                            <Select name="toAccount" required>
                                <SelectTrigger id="toAccount-transfer"><SelectValue placeholder="To..." /></SelectTrigger>
                                <SelectContent>
                                    {accountData.map(acc => (
                                      <SelectItem key={acc.id} value={acc.id}>
                                        {acc.name} ({formatCurrency(acc.balance)})
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="amount-transfer">Amount</Label>
                            <Input id="amount-transfer" name="amount" placeholder="e.g. 1000" required className="hide-number-arrows" value={amount} onChange={handleAmountChange} onBlur={handleAmountBlur}/>
                        </div>
                    </div>
                </TabsContent>
            </div>
          </Tabs>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button type="submit">Add Transaction</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
