
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet, Coins } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Omit<Account, 'balance'> & { balance: number }) | { id: WalletType, name: string, balance: number };

export function AccountBalances() {
  const [user] = useAuthState(auth);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: number, digital?: number }>({});
  const [loading, setLoading] = useState(true);
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
        if(loading) setLoading(false);
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
    } else if (!user && loading) {
        setLoading(false);
    }
  }, [user, db, loading]);

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

  const debouncedUpdateBalance = useCallback(useDebounce(async (accountId: string, value: number) => {
        if (!user || isNaN(value)) return;
        const accountRef = doc(db, "accounts", accountId);
        await updateDoc(accountRef, { actualBalance: value });
    }, 500), [user]);
    
  const debouncedUpdateWalletBalance = useCallback(useDebounce(async (walletType: 'cash' | 'digital', value: number) => {
    if (!user || isNaN(value)) return;
    const prefRef = doc(db, "user_preferences", user.uid);
    await setDoc(prefRef, { wallets: { [walletType]: value } }, { merge: true });
  }, 500), [user]);


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

  if (loading) {
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

  const cashBalanceDifference = walletPreferences.cash !== undefined ? cashWalletBalance - walletPreferences.cash : null;
  const digitalBalanceDifference = walletPreferences.digital !== undefined ? digitalWalletBalance - walletPreferences.digital : null;


  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Click any account to see a detailed balance breakdown. Enter actual balances to reconcile.</CardDescription>
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
                            <Input
                                id="actual-balance-cash"
                                type="number"
                                placeholder="Enter balance"
                                className="hide-number-arrows h-8"
                                defaultValue={walletPreferences.cash}
                                onChange={(e) => debouncedUpdateWalletBalance('cash', parseFloat(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {cashBalanceDifference !== null && (
                                <p className={cn(
                                    "text-xs font-medium",
                                    cashBalanceDifference === 0 && "text-green-600",
                                    cashBalanceDifference !== 0 && "text-red-600"
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
                            <Input
                                id="actual-balance-digital"
                                type="number"
                                placeholder="Enter balance"
                                className="hide-number-arrows h-8"
                                defaultValue={walletPreferences.digital}
                                onChange={(e) => debouncedUpdateWalletBalance('digital', parseFloat(e.target.value))}
                                onClick={(e) => e.stopPropagation()}
                            />
                            {digitalBalanceDifference !== null && (
                                <p className={cn(
                                    "text-xs font-medium",
                                    digitalBalanceDifference === 0 && "text-green-600",
                                    digitalBalanceDifference !== 0 && "text-red-600"
                                )}>
                                    Diff: {formatCurrency(digitalBalanceDifference)}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    const balanceDifference = account.actualBalance !== undefined ? account.balance - account.actualBalance : null;
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
                                <Input
                                    id={`actual-balance-${account.id}`}
                                    type="number"
                                    placeholder="Enter balance"
                                    className="hide-number-arrows h-8"
                                    defaultValue={account.actualBalance}
                                    onChange={(e) => debouncedUpdateBalance(account.id, parseFloat(e.target.value))}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {balanceDifference !== null && (
                                    <p className={cn(
                                        "text-xs font-medium",
                                        balanceDifference === 0 && "text-green-600",
                                        balanceDifference !== 0 && "text-red-600"
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
