
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export default function TransactionsPage() {
  const [user, userLoading] = useAuthState(auth);
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [reconciliationDate, setReconciliationDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const useDebounce = (callback: Function, delay: number) => {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    return (...args: any) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    };
  };

  const debouncedUpdateAccount = useCallback(useDebounce(async (accountId: string, data: { actualBalance?: number | null }) => {
        if (!user) return;
        const accountRef = doc(db, "accounts", accountId);
        await updateDoc(accountRef, { ...data, actualBalanceDate: reconciliationDate?.toISOString() });
    }, 500), [user, reconciliationDate]);
    
  const debouncedUpdateWallet = useCallback(useDebounce(async (walletType: 'cash' | 'digital', data: { balance?: number | null }) => {
    if (!user) return;
    const prefRef = doc(db, "user_preferences", user.uid);
    const updatedWallets = { 
        ...walletPreferences, 
        [walletType]: { ...walletPreferences[walletType], ...data, date: reconciliationDate?.toISOString() } 
    };
    await setDoc(prefRef, { wallets: updatedWallets }, { merge: true });
  }, 500), [user, walletPreferences, reconciliationDate]);


  useEffect(() => {
    if (user) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
        const userAccounts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Omit<Account, 'balance'>));
        setRawAccounts(userAccounts);
        if (dataLoading) setDataLoading(false);
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
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { accountBalances, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    const calculatedAccountBalances: { [key: string]: number } = {};
    rawAccounts.forEach(acc => {
      calculatedAccountBalances[acc.id] = 0; 
    });

    let calculatedCashBalance = 0;
    let calculatedDigitalBalance = 0;

    transactions.forEach(t => {
      if (t.type === 'income' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
        calculatedAccountBalances[t.accountId] += t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && calculatedAccountBalances[t.accountId] !== undefined) {
          calculatedAccountBalances[t.accountId] -= t.amount;
        } else if (t.paymentMethod === 'cash') {
          calculatedCashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          calculatedDigitalBalance -= t.amount;
        }
      } else if (t.type === 'transfer') {
        if (t.fromAccountId && calculatedAccountBalances[t.fromAccountId] !== undefined) {
          calculatedAccountBalances[t.fromAccountId] -= t.amount;
        } else if (t.fromAccountId === 'cash-wallet') {
          calculatedCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          calculatedDigitalBalance -= t.amount;
        }
        if (t.toAccountId && calculatedAccountBalances[t.toAccountId] !== undefined) {
          calculatedAccountBalances[t.toAccountId] += t.amount;
        } else if (t.toAccountId === 'cash-wallet') {
          calculatedCashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          calculatedDigitalBalance += t.amount;
        }
      }
    });

    return { 
      accountBalances: calculatedAccountBalances, 
      cashWalletBalance: calculatedCashBalance,
      digitalWalletBalance: calculatedDigitalBalance 
    };
  }, [rawAccounts, transactions]);
  
  const accounts = useMemo(() => {
    return rawAccounts.map(acc => ({
        ...acc,
        balance: accountBalances[acc.id] ?? 0,
    }));
  }, [rawAccounts, accountBalances]);


  const primaryAccount = accounts.find(a => a.isPrimary);

  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const allBalance = (primaryAccount?.balance || 0) + cashWalletBalance + digitalWalletBalance;

  const cashBalanceDifference = walletPreferences.cash?.balance !== undefined && walletPreferences.cash.balance !== null ? cashWalletBalance - walletPreferences.cash.balance : null;
  const digitalBalanceDifference = walletPreferences.digital?.balance !== undefined && walletPreferences.digital.balance !== null ? digitalWalletBalance - walletPreferences.digital.balance : null;
  const primaryAccountBalanceDifference = primaryAccount?.actualBalance !== undefined && primaryAccount?.actualBalance !== null ? primaryAccount.balance - primaryAccount.actualBalance : null;


  return (
    <div className="space-y-6">
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-[280px] justify-start text-left font-normal",
                        !reconciliationDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reconciliationDate ? `Reconciliation Date: ${format(reconciliationDate, "dd/MM/yyyy")}` : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={reconciliationDate}
                    onSelect={(date) => {
                      setReconciliationDate(date);
                      setIsDatePickerOpen(false);
                    }}
                    initialFocus
                />
            </PopoverContent>
        </Popover>

      <Tabs defaultValue={primaryAccount?.id || "all-accounts"} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 lg:grid-cols-4 h-auto flex-wrap">
          {primaryAccount && (
            <TabsTrigger value={primaryAccount.id} className={cn("border flex flex-col h-auto p-3 items-start text-left gap-4", "md:col-span-2")}>
              <div className="w-full flex justify-between">
                <span className="font-semibold text-sm">Primary ({primaryAccount.name})</span>
                <span className="font-bold text-primary">{formatCurrency(allBalance)}</span>
              </div>

              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                {/* Bank Column */}
                <div className="space-y-1">
                  <Label htmlFor={`actual-balance-${primaryAccount.id}`} className="text-xs">Bank Balance</Label>
                  <div className="font-mono text-xs">{formatCurrency(primaryAccount.balance)}</div>
                  <Input
                      id={`actual-balance-${primaryAccount.id}`}
                      type="number"
                      placeholder="Actual"
                      className="hide-number-arrows h-7 mt-1 text-xs"
                      defaultValue={primaryAccount.actualBalance ?? ''}
                      onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          debouncedUpdateAccount(primaryAccount.id, { actualBalance: value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                  />
                  {primaryAccountBalanceDifference !== null && (
                      <p className={cn(
                          "text-xs font-medium pt-1",
                          Math.round(primaryAccountBalanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                      )}>
                          Diff: {formatCurrency(primaryAccountBalanceDifference)}
                      </p>
                  )}
                </div>

                {/* Cash Column */}
                <div className="space-y-1">
                  <Label htmlFor="actual-balance-cash" className="text-xs">Cash</Label>
                   <div className="font-mono text-xs">{formatCurrency(cashWalletBalance)}</div>
                  <Input
                      id="actual-balance-cash"
                      type="number"
                      placeholder="Actual"
                      className="hide-number-arrows h-7"
                      defaultValue={walletPreferences.cash?.balance ?? ''}
                      onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          debouncedUpdateWallet('cash', { balance: value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                  />
                  {cashBalanceDifference !== null && (
                      <p className={cn(
                          "text-xs font-medium pt-1",
                          Math.round(cashBalanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                      )}>
                          Diff: {formatCurrency(cashBalanceDifference)}
                      </p>
                  )}
                </div>

                {/* Digital Column */}
                <div className="space-y-1">
                  <Label htmlFor="actual-balance-digital" className="text-xs">Digital</Label>
                    <div className="font-mono text-xs">{formatCurrency(digitalWalletBalance)}</div>
                   <Input
                      id="actual-balance-digital"
                      type="number"
                      placeholder="Actual"
                      className="hide-number-arrows h-7"
                      defaultValue={walletPreferences.digital?.balance ?? ''}
                      onChange={(e) => {
                          const value = e.target.value === '' ? null : parseFloat(e.target.value)
                          debouncedUpdateWallet('digital', { balance: value })
                      }}
                      onClick={(e) => e.stopPropagation()}
                  />
                  {digitalBalanceDifference !== null && (
                      <p className={cn(
                          "text-xs font-medium pt-1",
                           Math.round(digitalBalanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                      )}>
                          Diff: {formatCurrency(digitalBalanceDifference)}
                      </p>
                  )}
                </div>
              </div>
            </TabsTrigger>
          )}
          {accounts.filter(account => !account.isPrimary).map(account => {
            const balanceDifference = account.actualBalance !== undefined && account.actualBalance !== null ? account.balance - account.actualBalance : null;
            return (
              <TabsTrigger key={account.id} value={account.id} className="border flex flex-col h-auto p-2 items-start text-left gap-1">
                <div className="w-full flex justify-between">
                    <span className="font-semibold text-sm">{account.name}</span>
                    <span className="font-bold text-primary">{formatCurrency(account.balance)}</span>
                </div>
                <div className="w-full">
                    <div className="flex items-center gap-2">
                        <Label htmlFor={`actual-balance-${account.id}`} className="text-xs flex-shrink-0">Actual Balance</Label>
                        <Input
                            id={`actual-balance-${account.id}`}
                            type="number"
                            placeholder="0.00"
                            className="hide-number-arrows h-7 text-xs"
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
                            "text-xs font-medium pt-1 text-right",
                            Math.round(balanceDifference * 100) === 0 ? "text-green-600" : "text-red-600"
                        )}>
                            Diff: {formatCurrency(balanceDifference)}
                        </p>
                    )}
                </div>
              </TabsTrigger>
          )})}
        </TabsList>
        {primaryAccount && (
            <TabsContent value={primaryAccount.id} className="mt-6">
                <TransactionTable accountId={primaryAccount.id} />
            </TabsContent>
        )}
         {accounts.filter(account => !account.isPrimary).map(account => (
            <TabsContent key={account.id} value={account.id} className="mt-6">
                <TransactionTable accountId={account.id} />
            </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
