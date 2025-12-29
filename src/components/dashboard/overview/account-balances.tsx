
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet, Coins, CalendarIcon } from "lucide-react";
import { useAuthState } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";


type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Omit<Account, 'balance'> & { balance: number }) | { id: WalletType, name: string, balance: number };

export function AccountBalances() {
  const [user, loading] = useAuthState(auth);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [reconciliationDate, setReconciliationDate] = useState<Date | undefined>(new Date());
  const [dataLoading, setDataLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = [];
        snapshot.forEach((doc) => {
          const { balance, ...data } = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setRawAccounts(userAccounts);
        if(dataLoading) setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });
      
      const preferencesDocRef = doc(db, "user_preferences", user.uid);
      const unsubscribePreferences = onSnapshot(preferencesDocRef, (doc) => {
        if (doc.exists()) {
          setWalletPreferences(doc.data().wallets || {});
        }
      });


      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribePreferences();
      };
    } else if (!user && dataLoading) {
        setDataLoading(false);
    }
  }, [user, db, dataLoading]);

  const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
        calculatedAccountBalances[acc.id] = 0; // Start with 0
    });

    let calculatedCashWalletBalance = 0;
    let calculatedDigitalWalletBalance = 0;

    transactions.forEach(t => {
      // Wallet balance calculation
      if (t.type === 'transfer') {
        if (t.toAccountId === 'cash-wallet') calculatedCashWalletBalance += t.amount;
        if (t.fromAccountId === 'cash-wallet') calculatedCashWalletBalance -= t.amount;
        if (t.toAccountId === 'digital-wallet') calculatedDigitalWalletBalance += t.amount;
        if (t.fromAccountId === 'digital-wallet') calculatedDigitalWalletBalance -= t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'cash') calculatedCashWalletBalance -= t.amount;
        if (t.paymentMethod === 'digital') calculatedDigitalWalletBalance -= t.amount;
      }

        // Bank account balance calculation
        if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] -= t.amount;
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
                calculatedAccountBalances[t.fromAccountId] -= t.amount;
            }
            if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
                calculatedAccountBalances[t.toAccountId] += t.amount;
            }
        }
    });

    return { cashWalletBalance: calculatedCashWalletBalance, digitalWalletBalance: calculatedDigitalWalletBalance, accountBalances: calculatedAccountBalances };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0,
    }));
  }, [rawAccounts, accountBalances]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
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

  const debouncedUpdateAccount = useCallback(useDebounce(async (accountId: string, data: { actualBalance?: number | null, actualBalanceDate?: string }) => {
        if (!user) return;
        const accountRef = doc(db, "accounts", accountId);
        await updateDoc(accountRef, { ...data, actualBalanceDate: reconciliationDate?.toISOString() });
    }, 500), [user, reconciliationDate]);
    
  const debouncedUpdateWallet = useCallback(useDebounce(async (walletType: 'cash' | 'digital', data: { balance?: number | null, date?: string }) => {
    if (!user) return;
    const prefRef = doc(db, "user_preferences", user.uid);
    const updatedWallets = { 
        ...walletPreferences, 
        [walletType]: { ...walletPreferences[walletType], ...data, date: reconciliationDate?.toISOString() } 
    };
    await setDoc(prefRef, { wallets: updatedWallets }, { merge: true });
  }, 500), [user, walletPreferences, reconciliationDate]);


  const handleAccountClick = (accountOrWallet: Omit<Account, 'balance'> | WalletType) => {
    if (accountOrWallet === 'cash-wallet') {
      setSelectedAccountForDetails({
        id: 'cash-wallet',
        name: 'Cash Wallet',
        balance: cashWalletBalance
      });
    } else if (accountOrWallet === 'digital-wallet') {
      setSelectedAccountForDetails({
        id: 'digital-wallet',
        name: 'Digital Wallet',
        balance: digitalWalletBalance
      });
    } else {
      setSelectedAccountForDetails({
        ...accountOrWallet,
        balance: accountBalances[accountOrWallet.id] ?? 0
      });
    }
    setIsDetailsDialogOpen(true);
  };

  if (loading || dataLoading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      )
  }

  const cashBalanceDifference = walletPreferences.cash?.balance !== undefined && walletPreferences.cash.balance !== null ? cashWalletBalance - walletPreferences.cash.balance : null;
  const digitalBalanceDifference = walletPreferences.digital?.balance !== undefined && walletPreferences.digital.balance !== null ? digitalWalletBalance - walletPreferences.digital.balance : null;


  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardDescription>Click any account to see a detailed balance breakdown. Enter actual balances to reconcile.</CardDescription>
                 <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-full sm:w-[280px] justify-start text-left font-normal",
                                !reconciliationDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {reconciliationDate ? format(reconciliationDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={reconciliationDate}
                            onSelect={setReconciliationDate}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                 <Card>
                    <div className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('cash-wallet')}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Cash Wallet</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(cashWalletBalance)}</div>
                        </CardContent>
                    </div>
                     <CardContent className="pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="actual-balance-cash" className="text-xs">Actual Balance</Label>
                             <div className="flex gap-2">
                                <Input
                                    id="actual-balance-cash"
                                    type="number"
                                    placeholder="Enter balance"
                                    className="hide-number-arrows h-8"
                                    defaultValue={walletPreferences.cash?.balance ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                        debouncedUpdateWallet('cash', { balance: value })
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            {cashBalanceDifference !== null && (
                                <p className={cn(
                                    "text-xs font-medium pt-1",
                                    Math.round(cashBalanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                                )}>
                                    Diff: {formatCurrency(cashBalanceDifference)}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                 <Card>
                    <div className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('digital-wallet')}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Digital Wallet</CardTitle>
                        <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatCurrency(digitalWalletBalance)}</div>
                        </CardContent>
                    </div>
                     <CardContent className="pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="actual-balance-digital" className="text-xs">Actual Balance</Label>
                             <div className="flex gap-2">
                                <Input
                                    id="actual-balance-digital"
                                    type="number"
                                    placeholder="Enter balance"
                                    className="hide-number-arrows h-8"
                                    defaultValue={walletPreferences.digital?.balance ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                        debouncedUpdateWallet('digital', { balance: value })
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                            {digitalBalanceDifference !== null && (
                                <p className={cn(
                                    "text-xs font-medium pt-1",
                                    Math.round(digitalBalanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                                )}>
                                    Diff: {formatCurrency(digitalBalanceDifference)}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    const balanceDifference = account.actualBalance !== undefined && account.actualBalance !== null ? account.balance - account.actualBalance : null;
                    return (
                     <Card key={account.id}>
                        <div className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(account.balance)}</div>
                            </CardContent>
                        </div>
                        <CardContent className="pt-2">
                            <div className="space-y-2">
                                <Label htmlFor={`actual-balance-${account.id}`} className="text-xs">Actual Balance</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id={`actual-balance-${account.id}`}
                                        type="number"
                                        placeholder="Enter balance"
                                        className="hide-number-arrows h-8"
                                        defaultValue={account.actualBalance ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                            debouncedUpdateAccount(account.id, { actualBalance: value });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                {balanceDifference !== null && (
                                    <p className={cn(
                                        "text-xs font-medium pt-1",
                                        Math.round(balanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        Diff: {formatCurrency(balanceDifference)}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )})}
            </div>
        </CardContent>
    </Card>

    <AccountDetailsDialog
        account={selectedAccountForDetails}
        transactions={transactions}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
    />
    </>
  );
}
