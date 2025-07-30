"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account, Transaction } from "@/lib/data";
import { PlusCircle, Landmark, PiggyBank, CreditCard, Wallet, Star, GripVertical, Pencil } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, writeBatch, doc, orderBy, updateDoc } from "firebase/firestore";
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

function SortableAccountCard({ account, onSetPrimary, onEdit }: { account: Account, onSetPrimary: (id: string) => void, onEdit: (account: Account) => void }) {
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

    return (
        <div ref={setNodeRef} style={style} className="relative">
            <Card className="flex flex-col justify-between h-full">
                <div>
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
                <CardFooter className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {!account.isPrimary && (
                            <Button variant="outline" size="sm" onClick={() => onSetPrimary(account.id)}>
                                <Star className="mr-2 h-4 w-4" />
                                Set as Primary
                            </Button>
                        )}
                         <Button variant="outline" size="sm" onClick={() => onEdit(account)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </Button>
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
  const [user, loading] = useAuthState(auth);
  const sensors = useSensors(useSensor(PointerSensor));


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
            </CardContent>
        </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Your Bank Accounts</CardTitle>
          <CardDescription>
            Drag and drop to reorder your financial accounts.
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <SortableContext items={accountIds} strategy={rectSortingStrategy}>
            <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
              {accounts.map((account) => (
                <SortableAccountCard key={account.id} account={account} onSetPrimary={handleSetPrimary} onEdit={openEditDialog} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        {accounts.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
            <Landmark className="h-10 w-10 mb-2"/>
            <p>No accounts yet. Click "Add Account" to get started.</p>
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
    </>
  );
}
