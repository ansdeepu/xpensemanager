
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Landmark, Wallet, Coins } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";
import { useAuthState } from "@/hooks/use-auth-state";
import { isAfter, parseISO } from "date-fns";

type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Omit<Account, 'balance'> & { balance: number }) | { id: WalletType, name: string, balance: number, walletPreferences?: any };

export function AccountBalances() {
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts: Omit<Account, 'balance'>[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>));
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
    } else if (!user && !userLoading) {
        setDataLoading(false);
    }
  }, [user, db, dataLoading]);

    const { cashWalletBalance, digitalWalletBalance, accountBalances } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    const accountMap = new Map(rawAccounts.map(acc => [acc.id, acc]));

    rawAccounts.forEach(acc => {
      calculatedAccountBalances[acc.id] = 0; // Start with 0
    });

    let calculatedCashWalletBalance = 0;
    let calculatedDigitalWalletBalance = 0;
    
    const chronologicalTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    chronologicalTransactions.forEach(t => {
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

      // Bank/Card account balance calculation
      if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
        const account = accountMap.get(t.accountId);
        if (account?.type !== 'card') {
          calculatedAccountBalances[t.accountId] += t.amount;
        }
      } else if (t.type === 'expense' && t.accountId && t.paymentMethod === 'online' && calculatedAccountBalances[t.accountId] !== undefined) {
        const account = accountMap.get(t.accountId);
        if (account?.type === 'card') {
          calculatedAccountBalances[t.accountId] += t.amount; // For cards, expenses increase balance (debt)
        } else {
          calculatedAccountBalances[t.accountId] -= t.amount;
        }
      } else if (t.type === 'transfer') {
        // From account
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
          const fromAccount = accountMap.get(t.fromAccountId);
          if (fromAccount?.type === 'card') {
            calculatedAccountBalances[t.fromAccountId] += t.amount; // Cash advance increases debt
          } else {
            calculatedAccountBalances[t.fromAccountId] -= t.amount;
          }
        }
        // To account
        if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
          const toAccount = accountMap.get(t.toAccountId);
          if (toAccount?.type === 'card') {
            calculatedAccountBalances[t.toAccountId] -= t.amount; // Payment to card decreases debt
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
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const handleAccountClick = (accountOrWallet: Account | WalletType) => {
    if (accountOrWallet === 'cash-wallet') {
      setSelectedAccountForDetails({
        id: 'cash-wallet',
        name: 'Cash Wallet',
        balance: cashWalletBalance,
        walletPreferences: walletPreferences,
      });
    } else if (accountOrWallet === 'digital-wallet') {
      setSelectedAccountForDetails({
        id: 'digital-wallet',
        name: 'Digital Wallet',
        balance: digitalWalletBalance,
        walletPreferences: walletPreferences,
      });
    } else {
      setSelectedAccountForDetails({
        ...(accountOrWallet as Account),
        balance: accountBalances[(accountOrWallet as Account).id] ?? 0
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
              <CardContent className="grid gap-4 md:grid-cols-2">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
              </CardContent>
          </Card>
      )
  }

  return (
    <>
    <Card>
        <CardHeader>
            <CardTitle>Account Balances</CardTitle>
            <CardDescription>Click any account to see a detailed balance breakdown.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                 <Card className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('cash-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between p-3">
                    <CardTitle className="text-xs font-medium">Cash Wallet</CardTitle>
                    <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{formatCurrency(cashWalletBalance)}</div>
                    </CardContent>
                </Card>
                 <Card className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick('digital-wallet')}>
                    <CardHeader className="flex flex-row items-center justify-between p-3">
                    <CardTitle className="text-xs font-medium">Digital Wallet</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-lg font-bold">{formatCurrency(digitalWalletBalance)}</div>
                    </CardContent>
                </Card>
                {accounts.map(account => {
                    const balanceToShow = account.type === 'card' 
                        ? (account.limit || 0) - account.balance
                        : account.balance;
                    return (
                     <Card key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                        <CardHeader className="flex flex-row items-center justify-between p-3">
                        <CardTitle className="text-xs font-medium">{account.name}</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{formatCurrency(balanceToShow)}</div>
                            {account.type === 'card' && (
                                <p className="text-xs text-muted-foreground">Available</p>
                            )}
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
