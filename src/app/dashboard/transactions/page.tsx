
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import type { Account, Transaction } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isAfter, isSameDay, parseISO, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { CalendarIcon, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Printer, Search, XCircle, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuthState } from "@/hooks/use-auth-state";
import { Card, CardFooter, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AddTransactionDialog } from "@/components/dashboard/transactions/add-transaction-dialog";

const formatCurrency = (amount: number) => {
  if (Object.is(amount, -0)) {
    amount = 0;
  }
   if (amount % 1 === 0) {
      return new Intl.NumberFormat("en-IN", {
        style: "decimal",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
  return new Intl.NumberFormat("en-IN", {
    style: "decimal",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

const tabColors = [
  "bg-sky-100 dark:bg-sky-900/50",
  "bg-amber-100 dark:bg-amber-900/50",
  "bg-emerald-100 dark:bg-emerald-200",
  "bg-rose-100 dark:bg-rose-200",
  "bg-violet-100 dark:bg-violet-200",
  "bg-cyan-100 dark:bg-cyan-200",
  "bg-fuchsia-100 dark:bg-fuchsia-200",
];

const textColors = [
  "text-sky-800 dark:text-sky-200",
  "text-amber-800 dark:text-amber-200",
  "text-emerald-800 dark:text-emerald-200",
  "text-rose-800 dark:text-rose-200",
  "text-violet-800 dark:text-violet-200",
  "text-cyan-800 dark:text-cyan-200",
  "text-fuchsia-800 dark:text-fuchsia-200",
];

const PaginationControls = ({ currentPage, totalPages, setCurrentPage }: { currentPage: number, totalPages: number, setCurrentPage: (page: number) => void }) => (
    <div className="flex items-center gap-2 print-hide">
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => setCurrentPage(1)}
        disabled={currentPage === 1}
      >
        <span className="sr-only">Go to first page</span>
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => setCurrentPage(currentPage - 1)}
        disabled={currentPage === 1}
      >
        <span className="sr-only">Go to previous page</span>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center justify-center text-sm font-medium">
        Page {currentPage} of {totalPages}
      </div>
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => setCurrentPage(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        <span className="sr-only">Next page</span>
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        className="h-8 w-8 p-0"
        onClick={() => setCurrentPage(totalPages)}
        disabled={currentPage === totalPages}
      >
        <span className="sr-only">Go to last page</span>
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
);


export default function TransactionsPage() {
  const [user, userLoading] = useAuthState();
  const [rawAccounts, setRawAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reconciliationDate, setReconciliationDate] = useState<Date | undefined>();
  const itemsPerPage = 100;

  const useDebounce = (callback: Function, delay: number) => {
    const timeoutRef = useRef<any | null>(null);
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
  
  const handleReconciliationDateChange = async (date: Date | undefined) => {
    setReconciliationDate(date);
    if (!user || !date) return;
    const prefRef = doc(db, "user_preferences", user.uid);
    await setDoc(prefRef, { reconciliationDate: date.toISOString() }, { merge: true });
  };


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
        setAllTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
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
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

 const { accounts, cashWalletBalance, digitalWalletBalance } = useMemo(() => {
    let runningCashBalance = 0;
    let runningDigitalBalance = 0;
    const runningAccountBalances: { [key: string]: number } = {};

    rawAccounts.forEach(acc => {
        runningAccountBalances[acc.id] = 0;
    });

    const chronologicalTransactions = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chronologicalTransactions.forEach(t => {
      if (t.type === 'income' && t.accountId && runningAccountBalances[t.accountId] !== undefined) {
          runningAccountBalances[t.accountId] += t.amount;
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && runningAccountBalances[t.accountId] !== undefined) {
            runningAccountBalances[t.accountId] -= t.amount;
        } else if (t.paymentMethod === 'cash') {
          runningCashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          runningDigitalBalance -= t.amount;
        }
      } else if (t.type === 'transfer') {
        if (t.fromAccountId && runningAccountBalances[t.fromAccountId] !== undefined) {
          runningAccountBalances[t.fromAccountId] -= t.amount;
        } else if (t.fromAccountId === 'cash-wallet') {
          runningCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          runningDigitalBalance -= t.amount;
        }
        if (t.toAccountId && runningAccountBalances[t.toAccountId] !== undefined) {
          runningAccountBalances[t.toAccountId] += t.amount;
        } else if (t.toAccountId === 'cash-wallet') {
          runningCashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          runningDigitalBalance += t.amount;
        }
      }
    });

    const finalAccounts = rawAccounts.map(acc => ({
        ...acc,
        balance: runningAccountBalances[acc.id] ?? 0,
    }));
    
    return { 
      accounts: finalAccounts, 
      cashWalletBalance: runningCashBalance,
      digitalWalletBalance: runningDigitalBalance 
    };
  }, [rawAccounts, allTransactions]);

  const primaryAccount = accounts.find(a => a.isPrimary);
  
  useEffect(() => {
    if (primaryAccount && !activeTab) {
      setActiveTab(primaryAccount.id);
    }
  }, [primaryAccount, activeTab]);

  
  const secondaryAccounts = accounts.filter(account => !account.isPrimary && (account.name.toLowerCase().includes('hdfc') || account.name.toLowerCase().includes('fed') || account.name.toLowerCase().includes('post') || account.name.toLowerCase().includes('money')));
  const otherAccounts = accounts.filter(account => !account.isPrimary && !secondaryAccounts.some(sa => sa.id === account.id));

  const filteredTransactions = useMemo(() => {
    const isPrimaryView = primaryAccount?.id === activeTab;
    
    const sourceTransactions = allTransactions.filter(t => {
      const fromAccountIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
      const toAccountIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
      
      const fromCurrentView = isPrimaryView ? (t.fromAccountId === activeTab || fromAccountIsWallet) : t.fromAccountId === activeTab;
      const toCurrentView = isPrimaryView ? (t.toAccountId === activeTab || toAccountIsWallet) : t.toAccountId === activeTab;
      
      let accountIsInView = false;
      if (t.type === 'expense' || t.type === 'income') {
         accountIsInView = isPrimaryView 
            ? (t.accountId === activeTab || t.paymentMethod === 'cash' || t.paymentMethod === 'digital') 
            : t.accountId === activeTab;
      }
      
      return fromCurrentView || toCurrentView || accountIsInView;
    });

    let filtered = [...sourceTransactions];

    if (startDate && endDate) {
        const interval = { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) };
        filtered = filtered.filter(t => isWithinInterval(new Date(t.date), interval));
    }

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        filtered = filtered.filter(t => 
            t.description.toLowerCase().includes(lowercasedQuery) ||
            t.category.toLowerCase().includes(lowercasedQuery) ||
            (t.subcategory && t.subcategory.toLowerCase().includes(lowercasedQuery)) ||
            t.amount.toString().toLowerCase().includes(lowercasedQuery)
        );
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
          return dateA - dateB;
      }
      // If dates are same, transfers come first
      if (a.type === 'transfer' && b.type !== 'transfer') {
          return -1;
      }
      if (b.type === 'transfer' && a.type !== 'transfer') {
          return 1;
      }
      return 0;
    });
  }, [allTransactions, activeTab, startDate, endDate, searchQuery, primaryAccount]);


const transactionsWithRunningBalance = useMemo(() => {
    let runningBalance = 0;
    
    const chronologicalTransactions = [...filteredTransactions];
    
    const calculatedTransactions = chronologicalTransactions.map(t => {
        let effect = 0;
        const isPrimaryView = primaryAccount?.id === activeTab;
        const fromAccountIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
        const toAccountIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
        
        const fromCurrentView = isPrimaryView ? (t.fromAccountId === activeTab || fromAccountIsWallet) : t.fromAccountId === activeTab;
        const toCurrentView = isPrimaryView ? (t.toAccountId === activeTab || toAccountIsWallet) : t.toAccountId === activeTab;
        
        let accountIsInView = false;
        if (t.type === 'expense' || t.type === 'income') {
           accountIsInView = isPrimaryView 
              ? (t.accountId === activeTab || t.paymentMethod === 'cash' || t.paymentMethod === 'digital') 
              : t.accountId === activeTab;
        }

        if (t.type === 'income') {
            if (accountIsInView) effect = t.amount;
        } else if (t.type === 'expense') {
            if (accountIsInView) effect = -t.amount;
        } else if (t.type === 'transfer') {
            if (fromCurrentView && toCurrentView) {
                effect = 0; // Internal transfer within the same view
            } else if (fromCurrentView) {
                effect = -t.amount;
            } else if (toCurrentView) {
                effect = t.amount;
            }
        }
        runningBalance += effect;
        return { ...t, balance: runningBalance };
    });

    return calculatedTransactions.reverse();
}, [filteredTransactions, activeTab, primaryAccount]);


  const totalPages = Math.ceil(transactionsWithRunningBalance.length / itemsPerPage);

  const pagedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactionsWithRunningBalance.slice(startIndex, endIndex);
  }, [transactionsWithRunningBalance, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, searchQuery, activeTab]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setStartDate('');
    setEndDate('');
  }

  const handlePrint = () => {
    window.print();
  }


  if (userLoading || dataLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  
  const getBalanceDifference = (calculatedBalance: number, actualBalance?: number | null) => {
      if (actualBalance === undefined || actualBalance === null) return null;
      let diff = calculatedBalance - actualBalance;
      if (Math.abs(diff) < 0.01) diff = 0;
      return diff;
  }

  const cashBalanceDifference = getBalanceDifference(cashWalletBalance, walletPreferences.cash?.balance);
  const digitalBalanceDifference = getBalanceDifference(digitalWalletBalance, walletPreferences.digital?.balance);
  const primaryAccountBalanceDifference = primaryAccount ? getBalanceDifference(primaryAccount.balance, primaryAccount.actualBalance) : null;
  const allBalance = (primaryAccount ? primaryAccount.balance : 0) + cashWalletBalance + digitalWalletBalance;
  
  const accountDataForDialog = [
    { id: 'cash-wallet', name: 'Cash Wallet', balance: cashWalletBalance },
    { id: 'digital-wallet', name: 'Digital Wallet', balance: digitalWalletBalance },
    ...accounts,
  ];


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
        <div className="lg:col-span-2">
          <Tabs defaultValue={primaryAccount?.id || "all-accounts"} value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-1 md:grid-cols-2 gap-2 h-auto items-stretch p-0 bg-transparent print-hide">
                {primaryAccount && (
                  <TabsTrigger value={primaryAccount.id} className={cn("border flex flex-col h-full p-4 items-start text-left gap-4 w-full data-[state=active]:shadow-lg data-[state=active]:bg-lime-100 dark:data-[state=active]:bg-lime-900/50", "bg-card")}>
                    <div className="w-full flex justify-between">
                      <span className="font-semibold text-lg">Primary ({primaryAccount.name})</span>
                      <span className="font-bold text-2xl text-primary">{formatCurrency(allBalance)}</span>
                    </div>
                    
                    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-6 text-left py-4">
                      {/* Bank Column */}
                      <div className="space-y-2">
                        <Label htmlFor={`actual-balance-${primaryAccount.id}`} className="text-xs">Bank Balance</Label>
                        <div className="font-mono text-base">{formatCurrency(primaryAccount.balance)}</div>
                        <Input
                            id={`actual-balance-${primaryAccount.id}`}
                            type="number"
                            placeholder="Actual"
                            className="hide-number-arrows h-7 mt-1 text-xs text-left"
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
                                Math.abs(primaryAccountBalanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                            )}>
                                Diff: {formatCurrency(primaryAccountBalanceDifference)}
                            </p>
                        )}
                      </div>

                      {/* Cash Column */}
                      <div className="space-y-2">
                        <Label htmlFor="actual-balance-cash" className="text-xs">Cash</Label>
                        <div className="font-mono text-base">{formatCurrency(cashWalletBalance)}</div>
                        <Input
                            id="actual-balance-cash"
                            type="number"
                            placeholder="Actual"
                            className="hide-number-arrows h-7 text-left"
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
                                 Math.abs(cashBalanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                            )}>
                                Diff: {formatCurrency(cashBalanceDifference)}
                            </p>
                        )}
                      </div>

                      {/* Digital Column */}
                      <div className="space-y-2">
                        <Label htmlFor="actual-balance-digital" className="text-xs">Digital</Label>
                          <div className="font-mono text-base">{formatCurrency(digitalWalletBalance)}</div>
                        <Input
                            id="actual-balance-digital"
                            type="number"
                            placeholder="Actual"
                            className="hide-number-arrows h-7 text-left"
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
                                 Math.abs(digitalBalanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                            )}>
                                Diff: {formatCurrency(digitalBalanceDifference)}
                            </p>
                        )}
                      </div>
                    </div>
                  </TabsTrigger>
                )}
                <div className="grid grid-cols-2 gap-2 auto-rows-fr">
                  {secondaryAccounts.map((account, index) => {
                    const balanceDifference = getBalanceDifference(account.balance, account.actualBalance);
                    return (
                      <TabsTrigger key={account.id} value={account.id} className={cn("border flex flex-col h-full p-2 items-start text-left gap-1 data-[state=active]:shadow-lg", tabColors[index % tabColors.length], textColors[index % textColors.length])}>
                          <div className="w-full flex justify-between items-center">
                              <span className="font-semibold text-sm">{account.name}</span>
                              <span className="font-bold text-sm">{formatCurrency(account.balance)}</span>
                          </div>
                          <div className="w-full space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`actual-balance-${account.id}`} className="text-xs flex-shrink-0">Actual</Label>
                                <Input
                                    id={`actual-balance-${account.id}`}
                                    type="number"
                                    placeholder="Actual"
                                    className="hide-number-arrows h-6 text-xs w-20 text-right"
                                    defaultValue={account.actualBalance ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                        debouncedUpdateAccount(account.id, { actualBalance: value });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              {balanceDifference !== null && (
                                  <div className="w-full flex justify-end">
                                      <p className={cn(
                                          "text-xs font-medium",
                                          Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                                      )}>
                                          Diff: {formatCurrency(balanceDifference)}
                                      </p>
                                  </div>
                              )}
                          </div>
                      </TabsTrigger>
                  )})}
                  {otherAccounts.map((account, index) => {
                    const balanceDifference = getBalanceDifference(account.balance, account.actualBalance);
                    return (
                      <TabsTrigger key={account.id} value={account.id} className={cn("border flex flex-col h-full p-2 items-start text-left gap-1 data-[state=active]:shadow-lg", tabColors[(secondaryAccounts.length + index) % tabColors.length], textColors[(secondaryAccounts.length + index) % textColors.length])}>
                          <div className="w-full flex justify-between items-center">
                              <span className="font-semibold text-sm">{account.name}</span>
                              <span className="font-bold text-sm">{formatCurrency(account.balance)}</span>
                          </div>
                          <div className="w-full space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Label htmlFor={`actual-balance-${account.id}`} className="text-xs flex-shrink-0">Actual</Label>
                                <Input
                                    id={`actual-balance-${account.id}`}
                                    type="number"
                                    placeholder="Actual"
                                    className="hide-number-arrows h-6 text-xs w-20 text-right"
                                    defaultValue={account.actualBalance ?? ''}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                        debouncedUpdateAccount(account.id, { actualBalance: value });
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              {balanceDifference !== null && (
                                  <div className="w-full flex justify-end">
                                      <p className={cn(
                                          "text-xs font-medium",
                                          Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                                      )}>
                                          Diff: {formatCurrency(balanceDifference)}
                                      </p>
                                  </div>
                              )}
                          </div>
                      </TabsTrigger>
                  )})}
                </div>
            </TabsList>
          </Tabs>
        </div>
        <div className="lg:col-span-1">
            <Card className="print-hide">
                <CardContent className="pt-6">
                    <div className="flex flex-col gap-1">
                        <div className="space-y-1">
                            <Label htmlFor="reconciliation-date-input" className="text-xs flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-red-600" />
                                Reconciliation Date
                            </Label>
                            <Input
                                id="reconciliation-date-input"
                                type="date"
                                value={reconciliationDate ? format(reconciliationDate, 'yyyy-MM-dd') : ''}
                                onChange={(e) => {
                                    const dateValue = e.target.value;
                                    const newDate = dateValue ? new Date(dateValue) : undefined;
                                    if (newDate) {
                                        const timezoneOffset = newDate.getTimezoneOffset() * 60000;
                                        handleReconciliationDateChange(new Date(newDate.getTime() + timezoneOffset));
                                    } else {
                                        handleReconciliationDateChange(undefined);
                                    }
                                }}
                                className="w-full h-9"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="search-input" className="text-xs">Search Transactions</Label>
                            <div className="relative flex-grow">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                id="search-input"
                                type="search"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-lg bg-background pl-8 h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                             <Label className="text-xs">Filter by Date Range</Label>
                             <div className="flex items-center gap-2">
                                <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full h-9"
                                />
                                <span className="text-muted-foreground text-xs">to</span>
                                <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full h-9"
                                min={startDate}
                                />
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-start gap-2 pt-1">
                            <Button onClick={handleClearFilters} variant="outline" size="sm">
                                <XCircle className="mr-2 h-4 w-4" />
                                Clear
                            </Button>
                            <Button onClick={handlePrint} variant="outline" size="sm">
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                            </Button>
                            <AddTransactionDialog accounts={accountDataForDialog}>
                                <Button size="sm">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Add
                                </Button>
                            </AddTransactionDialog>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
      
      <Card>
          <CardContent className="p-0">
            <TransactionTable 
                transactions={pagedTransactions} 
                accountId={activeTab || ''}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
            />
          </CardContent>
          {totalPages > 1 && (
              <CardFooter className="justify-center border-t p-4 print-hide">
                <PaginationControls currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage as (page: number) => void} />
              </CardFooter>
          )}
      </Card>
    </div>
  );
}

    