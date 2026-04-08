
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
import { useAuthState } from "@/hooks/use-auth-state";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, setDoc } from "firebase/firestore";
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
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [reconciliationDate, setReconciliationDate] = useState<Date | undefined>();
  const [dataLoading, setDataLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  const accountUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const walletUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          userAccounts.push({ id: doc.id, ...data } as Omit<Account, 'balance'>);
        });
        setRawAccounts(userAccounts);
        setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });
      
      const preferencesDocRef = doc(db, "user_preferences", user.uid);
      const unsubscribePreferences = onSnapshot(preferencesDocRef, (doc) => {
        if (doc.exists()) {
          const prefs = doc.data();
          setWalletPreferences(prefs.wallets || {});
          if (prefs.reconciliationDate) {
              setReconciliationDate(new Date(prefs.reconciliationDate));
          } else {
              setReconciliationDate(new Date());
          }
        } else {
             setReconciliationDate(new Date());
        }
      });


      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribePreferences();
      };
    } else if (!user && !userLoading) {
        setDataLoading(false);
    }
  }, [user, userLoading]);

  const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
        calculatedAccountBalances[acc.id] = 0;
    });

    let calculatedCashWalletBalance = 0;
    let calculatedDigitalWalletBalance = 0;

    const chronologicalTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    chronologicalTransactions.forEach(t => {
      if (t.type === 'transfer') {
        if (t.toAccountId === 'cash-wallet') calculatedCashWalletBalance += t.amount;
        if (t.fromAccountId === 'cash-wallet') calculatedCashWalletBalance -= t.amount;
        if (t.toAccountId === 'digital-wallet') calculatedDigitalWalletBalance += t.amount;
        if (t.fromAccountId === 'digital-wallet') calculatedDigitalWalletBalance -= t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'cash') calculatedCashWalletBalance -= t.amount;
        if (t.paymentMethod === 'digital') calculatedDigitalWalletBalance -= t.amount;
      }

        if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
            calculatedAccountBalances[t.accountId] += t.amount;
        } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && calculatedAccountBalances[t.accountId] !== undefined) {
            const isCard = rawAccounts.find(a => a.id === t.accountId)?.type === 'card';
            if (isCard) {
                calculatedAccountBalances[t.accountId] += t.amount;
            } else {
                calculatedAccountBalances[t.accountId] -= t.amount;
            }
        } else if (t.type === 'transfer') {
            if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
                const isCard = rawAccounts.find(a => a.id === t.fromAccountId)?.type === 'card';
                if (isCard) {
                    calculatedAccountBalances[t.fromAccountId] += t.amount;
                } else {
                    calculatedAccountBalances[t.fromAccountId] -= t.amount;
                }
            }
            if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
                const isCard = rawAccounts.find(a => a.id === t.toAccountId)?.type === 'card';
                if (isCard) {
                    calculatedAccountBalances[t.toAccountId] -= t.amount;
                } else {
                    calculatedAccountBalances[t.toAccountId] += t.amount;
                }
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
    let val = amount;
    if (Object.is(val, -0)) val = 0;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);
  };

  const debouncedUpdateAccount = useCallback((accountId: string, data: { actualBalance?: number | null }) => {
    if (accountUpdateTimeoutRef.current) clearTimeout(accountUpdateTimeoutRef.current);
    accountUpdateTimeoutRef.current = setTimeout(async () => {
        if (!user) return;
        const accountRef = doc(db, "accounts", accountId);
        await updateDoc(accountRef, { ...data, actualBalanceDate: reconciliationDate?.toISOString() });
    }, 500);
  }, [user, reconciliationDate]);
    
  const debouncedUpdateWallet = useCallback((walletType: 'cash' | 'digital', data: { balance?: number | null }) => {
    if (walletUpdateTimeoutRef.current) clearTimeout(walletUpdateTimeoutRef.current);
    walletUpdateTimeoutRef.current = setTimeout(async () => {
        if (!user) return;
        const prefRef = doc(db, "user_preferences", user.uid);
        const updatedWallets = { 
            ...walletPreferences, 
            [walletType]: { ...walletPreferences[walletType], ...data, date: reconciliationDate?.toISOString() } 
        };
        await setDoc(prefRef, { wallets: updatedWallets }, { merge: true });
    }, 500);
  }, [user, walletPreferences, reconciliationDate]);


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

  if (userLoading || dataLoading) {
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

  const cashBalanceDifference = walletPreferences.cash?.balance !== undefined ? cashWalletBalance - (walletPreferences.cash.balance || 0) : null;
  const digitalBalanceDifference = walletPreferences.digital?.balance !== undefined ? digitalWalletBalance - (walletPreferences.digital.balance || 0) : null;


  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardDescription>Click any account to see a detailed breakdown. Enter actual balances to reconcile.</CardDescription>
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
                                    Math.abs(cashBalanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
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
                                    Math.abs(digitalBalanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                                )}>
                                    Diff: {formatCurrency(digitalBalanceDifference)}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    const isCard = account.type === 'card';
                    const availableLimit = isCard ? ((account.limit || 0) - account.balance) : 0;
                    const displayBalance = isCard ? availableLimit : account.balance;
                    
                    let balanceDifference: number | null = null;
                    if (account.actualBalance !== undefined && account.actualBalance !== null) {
                        balanceDifference = displayBalance - account.actualBalance;
                    }

                    return (
                     <Card key={account.id}>
                        <div className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(displayBalance)}</div>
                                {isCard && <p className="text-[10px] text-muted-foreground mt-1">Available of {formatCurrency(account.limit || 0)}</p>}
                            </CardContent>
                        </div>
                        <CardContent className="pt-2">
                            <div className="space-y-2">
                                <Label htmlFor={`actual-balance-${account.id}`} className="text-xs">{isCard ? 'Actual Available' : 'Actual Balance'}</Label>
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
                                        Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
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
