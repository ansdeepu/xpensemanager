
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

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
      const reconDate = acc.actualBalanceDate ? parseISO(acc.actualBalanceDate) : new Date(0);
      calculatedAccountBalances[acc.id] = acc.actualBalance ?? 0;
      transactions.forEach(t => {
        const transactionDate = parseISO(t.date);
        if (isAfter(transactionDate, reconDate)) {
          if (t.type === 'income' && t.accountId === acc.id) {
            calculatedAccountBalances[acc.id] += t.amount;
          } else if (t.type === 'expense' && t.paymentMethod === 'online' && t.accountId === acc.id) {
            calculatedAccountBalances[acc.id] -= t.amount;
          } else if (t.type === 'transfer') {
            if (t.fromAccountId === acc.id) {
              calculatedAccountBalances[acc.id] -= t.amount;
            }
            if (t.toAccountId === acc.id) {
              calculatedAccountBalances[acc.id] += t.amount;
            }
          }
        }
      });
    });

    const cashReconDate = walletPreferences.cash?.date ? parseISO(walletPreferences.cash.date) : new Date(0);
    let calculatedCashBalance = walletPreferences.cash?.balance ?? 0;
    const digitalReconDate = walletPreferences.digital?.date ? parseISO(walletPreferences.digital.date) : new Date(0);
    let calculatedDigitalBalance = walletPreferences.digital?.balance ?? 0;

    transactions.forEach(t => {
      const transactionDate = parseISO(t.date);
      if (t.paymentMethod === 'cash' && isAfter(transactionDate, cashReconDate)) {
        calculatedCashBalance -= t.amount;
      } else if (t.fromAccountId === 'cash-wallet' && isAfter(transactionDate, cashReconDate)) {
        calculatedCashBalance -= t.amount;
      } else if (t.toAccountId === 'cash-wallet' && isAfter(transactionDate, cashReconDate)) {
        calculatedCashBalance += t.amount;
      }

      if (t.paymentMethod === 'digital' && isAfter(transactionDate, digitalReconDate)) {
        calculatedDigitalBalance -= t.amount;
      } else if (t.fromAccountId === 'digital-wallet' && isAfter(transactionDate, digitalReconDate)) {
        calculatedDigitalBalance -= t.amount;
      } else if (t.toAccountId === 'digital-wallet' && isAfter(transactionDate, digitalReconDate)) {
        calculatedDigitalBalance += t.amount;
      }
    });

    return { 
      accountBalances: calculatedAccountBalances, 
      cashWalletBalance: calculatedCashBalance,
      digitalWalletBalance: calculatedDigitalBalance 
    };
  }, [rawAccounts, transactions, walletPreferences]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? (acc.actualBalance ?? 0),
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
                    return (
                     <Card key={account.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleAccountClick(account)}>
                        <CardHeader className="flex flex-row items-center justify-between p-3">
                        <CardTitle className="text-xs font-medium">{account.name}</CardTitle>
                        <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent className="p-3 pt-0">
                            <div className="text-lg font-bold">{formatCurrency(account.balance)}</div>
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
