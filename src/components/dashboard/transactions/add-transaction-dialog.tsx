
"use client"

import { useState, useEffect, useMemo, useRef } from "react";
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


export function AddTransactionDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [user] = useAuthState();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactionType, setTransactionType] = useState<Transaction["type"]>("expense");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [amount, setAmount] = useState("");
  const { toast } = useToast();

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

      return () => {
        unsubscribeAccounts();
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

  const accountOptions = [
    { id: "cash-wallet", name: "Cash Wallet" },
    { id: "digital-wallet", name: "Digital Wallet" },
    ...accounts
  ];


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Transaction
        </Button>
      </DialogTrigger>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-md">
        <form onSubmit={handleAddTransaction}>
          <DialogHeader>
            <DialogTitle>Add New Transaction</DialogTitle>
            <DialogDescription>
              Record a new income, expense, or transfer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="transaction-type">Transaction Type</Label>
                <Select name="type" value={transactionType} onValueChange={(value) => setTransactionType(value as Transaction['type'])}>
                    <SelectTrigger id="transaction-type">
                        <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="expense">Expense</SelectItem>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
            </div>

            {transactionType !== 'transfer' && (
                <>
                   <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" name="description" placeholder="e.g. Groceries" required />
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="category">Category</Label>
                            <Select name="category" onValueChange={setSelectedCategory}>
                                <SelectTrigger id="category">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.filter(c => {
                                        if (transactionType === 'expense') {
                                            return c.type === 'expense' || c.type === 'bank-expense';
                                        }
                                        return c.type === transactionType;
                                    }).map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subcategory">Sub-category</Label>
                            <Select name="subcategory" disabled={!selectedCategory || subcategories.length === 0}>
                                <SelectTrigger id="subcategory">
                                    <SelectValue placeholder="Select sub-category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {subcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </>
            )}

            {transactionType === 'transfer' && (
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input id="description" name="description" placeholder="e.g. Move to savings" />
                </div>
            )}
            
            {transactionType === 'expense' && (
                <div className="space-y-2">
                    <Label htmlFor="account">Payment Method</Label>
                    <Select name="account" required>
                        <SelectTrigger id="account">
                            <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                        <SelectContent>
                            {accountOptions.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {transactionType === 'income' && (
                 <div className="space-y-2">
                    <Label htmlFor="account">Bank Account</Label>
                    <Select name="account" required>
                        <SelectTrigger id="account">
                            <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                            {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {transactionType === 'transfer' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="fromAccount">From</Label>
                        <Select name="fromAccount" required>
                            <SelectTrigger id="fromAccount"><SelectValue placeholder="From..." /></SelectTrigger>
                            <SelectContent>
                                {accountOptions.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="toAccount">To</Label>
                        <Select name="toAccount" required>
                            <SelectTrigger id="toAccount"><SelectValue placeholder="To..." /></SelectTrigger>
                            <SelectContent>
                                {accountOptions.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
             <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                 <Input
                    id="amount"
                    name="amount"
                    placeholder="e.g. 500 or 100+50"
                    required
                    className="hide-number-arrows"
                    value={amount}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                />
            </div>

          </div>
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


    