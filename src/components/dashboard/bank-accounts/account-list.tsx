
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
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
import type { Account, Transaction } from "@/lib/data";
import { PlusCircle, Landmark, PiggyBank, CreditCard, Wallet, Star, GripVertical, Pencil, Coins, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, writeBatch, doc, orderBy, updateDoc, deleteDoc, getDocs } from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

// Map icon names to components
const iconComponents: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Landmark: Landmark,
  PiggyBank: PiggyBank,
  CreditCard: CreditCard,
  Wallet: Wallet,
};

const getRandomIcon = () => {
  const icons = Object.keys(iconComponents);
  const iconName = icons[Math.floor(Math.random() * icons.length)] as keyof typeof iconComponents;
  return { name: iconName, component: iconComponents[iconName] };
}

type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Omit<Account, 'balance'> & { balance: number }) | { id: WalletType, name: string, balance: number };


function SortableAccountCard({ account, onSetPrimary, onEdit, onDelete, onOpenDetails, onActualBalanceChange }: { account: Account, onSetPrimary: (id: string) => void, onEdit: (account: Account) => void, onDelete: (accountId: string) => void, onOpenDetails: (account: Account) => void, onActualBalanceChange: (id: string, value: number) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: account.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    
    const IconComponent = iconComponents[account.icon] || Landmark;
    const balanceDifference = account.actualBalance !== undefined ? account.balance - account.actualBalance : null;


    return (
        <div ref={setNodeRef} style={style} className="relative">
            <Card className="flex flex-col justify-between h-full group">
                <div onClick={() => onOpenDetails(account)} className="cursor-pointer">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xl font-bold">
                            {account.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {account.isPrimary && <Badge variant="secondary" className="border-primary text-primary">Primary</Badge>}
                            <IconComponent className="h-6 w-6 text-muted-foreground" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {formatCurrency(account.balance)}
                        </div>
                        <p className="text-sm text-muted-foreground">{account.purpose}</p>
                    </CardContent>
                </div>
                 <CardContent className="pt-2">
                    <div className="space-y-2">
                        <Label htmlFor={`actual-balance-${account.id}`}>Actual Balance</Label>
                        <Input
                            id={`actual-balance-${account.id}`}
                            type="number"
                            placeholder="Enter actual balance"
                            className="hide-number-arrows"
                            defaultValue={account.actualBalance}
                            onChange={(e) => onActualBalanceChange(account.id, parseFloat(e.target.value))}
                            onClick={(e) => e.stopPropagation()}
                        />
                         {balanceDifference !== null && (
                            <p className={cn(
                                "text-sm font-medium",
                                balanceDifference === 0 && "text-green-600",
                                balanceDifference !== 0 && "text-red-600"
                            )}>
                                Difference: {formatCurrency(balanceDifference)}
                            </p>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {!account.isPrimary && (
                            <Button variant="outline" size="sm" onClick={(e) => {e.stopPropagation(); onSetPrimary(account.id)}}>
                                <Star className="mr-2 h-4 w-4" />
                                Set as Primary
                            </Button>
                        )}
                         <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(account)}}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" onClick={(e) => e.stopPropagation()}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will permanently delete the "{account.name}" account. All transactions associated with this account will be re-assigned to your primary account. This action cannot be undone.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(account.id)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                    </div>
                    <div {...attributes} {...listeners} className="touch-none p-2 cursor-grab ml-auto text-muted-foreground hover:text-foreground">
                        <GripVertical className="h-5 w-5" />
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

export function AccountList({ initialAccounts }: { initialAccounts: Omit<Account, 'id' | 'userId'>[] }) {
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  const [user, loading] = useAuthState(auth);
  const sensors = useSensors(useSensor(PointerSensor));
  const { toast } = useToast();


  useEffect(() => {
    if (user && db) {
      const q = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(q, (querySnapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = [];
        querySnapshot.forEach((doc) => {
          const { balance, ...data } = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setRawAccounts(userAccounts);
      }, (error) => {
      });
      
      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
          setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });


      return () => {
          unsubscribeAccounts();
          unsubscribeTransactions();
      }
    }
  }, [user, db]);

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


  const accounts = useMemo(() => {
    const balances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
        balances[acc.id] = 0; // Start with 0
    });

    transactions.forEach(t => {
        if (t.type === 'income' && t.accountId && balances[t.accountId] !== undefined) {
            balances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && balances[t.accountId] !== undefined) {
            balances[t.accountId] -= t.amount;
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && balances[t.fromAccountId] !== undefined) {
                balances[t.fromAccountId] -= t.amount;
            }
            if (t.toAccountId && balances[t.toAccountId] !== undefined) {
                balances[t.toAccountId] += t.amount;
            }
        }
    });

    return rawAccounts.map(acc => ({
        ...acc,
        balance: balances[acc.id] ?? 0,
    }));
  }, [rawAccounts, transactions]);
  
  const accountIds = useMemo(() => accounts.map(a => a.id), [accounts]);


  const handleAddAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const formData = new FormData(event.currentTarget);
    const { name: iconName } = getRandomIcon();
    
    const isFirstAccount = accounts.length === 0;

    const newAccount = {
      userId: user.uid,
      name: formData.get("name") as string,
      purpose: formData.get("purpose") as string,
      icon: iconName,
      isPrimary: isFirstAccount,
      order: accounts.length,
      actualBalance: parseFloat(formData.get("balance") as string) || 0,
    };

    try {
      await addDoc(collection(db, "accounts"), newAccount);
      setIsAddDialogOpen(false);
    } catch (error) {
    }
  };

  const handleEditAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedAccount) return;

    const formData = new FormData(event.currentTarget);
    const updatedData = {
      name: formData.get("name") as string,
      purpose: formData.get("purpose") as string,
    };

    try {
      const accountRef = doc(db, "accounts", selectedAccount.id);
      await updateDoc(accountRef, updatedData);
      setIsEditDialogOpen(false);
      setSelectedAccount(null);
    } catch (error) {
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!user) return;
    const accountToDelete = accounts.find(acc => acc.id === accountId);
    if (!accountToDelete) return;
    if (accountToDelete.isPrimary) {
      toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: "You cannot delete your primary account. Please set another account as primary first.",
      });
      return;
    }

    const primaryAccount = accounts.find(acc => acc.isPrimary);
    if (!primaryAccount) {
         toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: "No primary account found to re-assign transactions to.",
        });
        return;
    }

    try {
      // Start a batch write
      const batch = writeBatch(db);

      // Query for all transactions associated with the account to be deleted
      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const transactionsSnapshot = await getDocs(transactionsQuery);

      let updatedCount = 0;
      transactionsSnapshot.forEach(transactionDoc => {
        const transaction = { id: transactionDoc.id, ...transactionDoc.data() } as Transaction;
        let needsUpdate = false;
        const updateData: Partial<Transaction> = {};
        
        // Re-assign accountId for income/expenses
        if (transaction.accountId === accountId) {
          updateData.accountId = primaryAccount.id;
          needsUpdate = true;
        }
        // Re-assign fromAccountId for transfers
        if (transaction.fromAccountId === accountId) {
          updateData.fromAccountId = primaryAccount.id;
           needsUpdate = true;
        }
        // Re-assign toAccountId for transfers
        if (transaction.toAccountId === accountId) {
          updateData.toAccountId = primaryAccount.id;
           needsUpdate = true;
        }

        if (needsUpdate) {
          batch.update(transactionDoc.ref, updateData);
          updatedCount++;
        }
      });
      
      // Delete the account
      const accountRef = doc(db, "accounts", accountId);
      batch.delete(accountRef);

      // Commit the batch
      await batch.commit();

      toast({
        title: "Account Deleted",
        description: `Successfully deleted the account and re-assigned ${updatedCount} transaction(s).`,
      });
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "Deletion Failed",
        description: error.message || "An error occurred while deleting the account.",
      });
    }
  };


  const handleSetPrimary = async (accountId: string) => {
    if (!user) return;
    const batch = writeBatch(db);
    
    const currentPrimary = accounts.find(acc => acc.isPrimary);
    if (currentPrimary && currentPrimary.id !== accountId) {
        const currentPrimaryRef = doc(db, "accounts", currentPrimary.id);
        batch.update(currentPrimaryRef, { isPrimary: false });
    }

    const newPrimaryRef = doc(db, "accounts", accountId);
    batch.update(newPrimaryRef, { isPrimary: true });

    try {
        await batch.commit();
    } catch (error) {
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active.id !== over?.id) {
        const oldIndex = accountIds.indexOf(active.id as string);
        const newIndex = accountIds.indexOf(over!.id as string);
        const reorderedItems = arrayMove(accounts, oldIndex, newIndex);
        setRawAccounts(reorderedItems.map(({ balance, ...rest }) => rest));


        const batch = writeBatch(db);
        reorderedItems.forEach((item, index) => {
          const docRef = doc(db, "accounts", item.id);
          batch.update(docRef, { order: index });
        });
        batch.commit().catch(err => {});
    }
  }

  const openEditDialog = (account: Account) => {
    setSelectedAccount(account);
    setIsEditDialogOpen(true);
  }

  const handleOpenDetails = (accountOrWallet: Account | WalletType) => {
    if (accountOrWallet === 'cash-wallet') {
      setSelectedAccountForDetails({
        id: 'cash-wallet',
        name: 'Cash Wallet',
        balance: cashWalletBalance,
      });
    } else if (accountOrWallet === 'digital-wallet') {
      setSelectedAccountForDetails({
        id: 'digital-wallet',
        name: 'Digital Wallet',
        balance: digitalWalletBalance,
      });
    } else {
      setSelectedAccountForDetails({
        ...accountOrWallet,
        balance: accountOrWallet.balance,
      });
    }
    setIsDetailsDialogOpen(true);
  };

  const useDebounce = (callback: Function, delay: number) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    return (...args: any) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    };
  };

  const debouncedUpdateBalance = useCallback(useDebounce(async (accountId: string, value: number) => {
        if (!user || isNaN(value)) return;
        const accountRef = doc(db, "accounts", accountId);
        await updateDoc(accountRef, { actualBalance: value });
    }, 500), [user]);



  if (loading) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </CardHeader>
            <CardContent className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
            </CardContent>
        </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Financial Accounts</CardTitle>
          <CardDescription>
            Manage your bank accounts and view your wallets.
          </CardDescription>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleAddAccount}>
              <DialogHeader>
                <DialogTitle>Add New Bank Account</DialogTitle>
                <DialogDescription>
                  Enter the details for your new bank account.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input id="name" name="name" placeholder="e.g. Savings" className="col-span-3" required />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="purpose" className="text-right">
                    Purpose
                  </Label>
                  <Input id="purpose" name="purpose" placeholder="e.g. Salary Account" className="col-span-3" required />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="balance" className="text-right">
                    Actual Balance
                  </Label>
                  <Input id="balance" name="balance" type="number" placeholder="e.g. 50000" className="col-span-3" />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary">Cancel</Button>
                </DialogClose>
                <Button type="submit">Add Account</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
            <Card className="flex flex-col justify-between h-full group cursor-pointer" onClick={() => handleOpenDetails('cash-wallet')}>
                <div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xl font-bold">
                            Cash Wallet
                        </CardTitle>
                        <Coins className="h-6 w-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {formatCurrency(cashWalletBalance)}
                        </div>
                        <p className="text-sm text-muted-foreground">For cash in hand</p>
                    </CardContent>
                </div>
                <CardFooter>
                    <Badge variant="outline">Built-in</Badge>
                </CardFooter>
            </Card>

            <Card className="flex flex-col justify-between h-full group cursor-pointer" onClick={() => handleOpenDetails('digital-wallet')}>
                <div>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xl font-bold">
                            Digital Wallet
                        </CardTitle>
                        <Wallet className="h-6 w-6 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {formatCurrency(digitalWalletBalance)}
                        </div>
                        <p className="text-sm text-muted-foreground">For e-wallet payments</p>
                    </CardContent>
                </div>
                <CardFooter>
                    <Badge variant="outline">Built-in</Badge>
                </CardFooter>
            </Card>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              modifiers={[restrictToWindowEdges]}
            >
              <SortableContext items={accountIds} strategy={rectSortingStrategy}>
                  {accounts.map((account) => (
                    <SortableAccountCard key={account.id} account={account} onSetPrimary={handleSetPrimary} onEdit={openEditDialog} onDelete={handleDeleteAccount} onOpenDetails={handleOpenDetails} onActualBalanceChange={debouncedUpdateBalance} />
                  ))}
              </SortableContext>
            </DndContext>
        </div>
        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
            <Landmark className="h-10 w-10 mb-2"/>
            <p>No bank accounts yet. Click "Add Account" to get started.</p>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Edit Account Dialog */}
    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditAccount}>
            <DialogHeader>
                <DialogTitle>Edit Account</DialogTitle>
                <DialogDescription>
                Update the details for your account.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">
                        Name
                    </Label>
                    <Input id="edit-name" name="name" defaultValue={selectedAccount?.name} className="col-span-3" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-purpose" className="text-right">
                        Purpose
                    </Label>
                    <Input id="edit-purpose" name="purpose" defaultValue={selectedAccount?.purpose} className="col-span-3" required />
                </div>
            </div>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="secondary" onClick={() => setSelectedAccount(null)}>Cancel</Button>
                </DialogClose>
                <Button type="submit">Save Changes</Button>
            </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
     <AccountDetailsDialog
        account={selectedAccountForDetails}
        transactions={transactions}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
    />
    </>
  );
}

    

    



    