
"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { TransactionTable } from "@/components/dashboard/transactions/transaction-table";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, setDoc, updateDoc } from "firebase/firestore";
import type { Account, Transaction, Loan } from "@/lib/data";
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
import { Badge } from "@/components/ui/badge";
import { AccountDetailsDialog } from "@/components/dashboard/account-details-dialog";

type WalletType = 'cash-wallet' | 'digital-wallet';
type AccountForDetails = (Account) | { id: WalletType, name: string, balance: number, walletPreferences?: any };


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
  "bg-orange-100 dark:bg-orange-900/50",
];

const textColors = [
  "text-sky-800 dark:text-sky-200",
  "text-amber-800 dark:text-amber-200",
  "text-emerald-800 dark:text-emerald-200",
  "text-rose-800 dark:text-rose-200",
  "text-violet-800 dark:text-violet-200",
  "text-cyan-800 dark:text-cyan-200",
  "text-fuchsia-800 dark:text-fuchsia-200",
  "text-orange-800 dark:text-orange-200",
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
  const [loans, setLoans] = useState<Loan[]>([]);
  const [walletPreferences, setWalletPreferences] = useState<{ cash?: { balance?: number, date?: string }, digital?: { balance?: number, date?: string } }>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [reconciliationDate, setReconciliationDate] = useState<Date | undefined>();
  const itemsPerPage = 100;
  
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedAccountForDetails, setSelectedAccountForDetails] = useState<AccountForDetails | null>(null);

  const primaryAccount = useMemo(() => rawAccounts.find(a => a.isPrimary), [rawAccounts]);

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
      
      const loansQuery = query(collection(db, "loans"), where("userId", "==", user.uid));
        const unsubscribeLoans = onSnapshot(loansQuery, (snapshot) => {
            const userLoans = snapshot.docs.map(doc => {
                const data = doc.data();
                const transactions = data.transactions || [];
                const totalLoan = transactions.filter((t: any) => t.type === 'loan').reduce((sum: number, t: any) => sum + t.amount, 0);
                const totalRepayment = transactions.filter((t: any) => t.type === 'repayment').reduce((sum: number, t: any) => sum + t.amount, 0);
                return {
                    id: doc.id,
                    ...data,
                    transactions,
                    totalLoan,
                    totalRepayment,
                    balance: totalLoan - totalRepayment,
                } as Loan;
            });
            setLoans(userLoans);
        });

      return () => {
        unsubscribeAccounts();
        unsubscribeTransactions();
        unsubscribePreferences();
        unsubscribeLoans();
      };
    } else if (!userLoading) {
      setDataLoading(false);
    }
  }, [user, userLoading, dataLoading]);

  const { accounts, cashWalletBalance, digitalWalletBalance, transactionBalanceMap } = useMemo(() => {
    let runningCashBalance = 0;
    let runningDigitalBalance = 0;
    const runningAccountBalances: { [key: string]: number } = {};
    const accountMap = new Map(rawAccounts.map(acc => [acc.id, acc]));

    rawAccounts.forEach(acc => {
        runningAccountBalances[acc.id] = 0;
    });

    const chronologicalTransactions = [...allTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    chronologicalTransactions.forEach(t => {
      // Income
      if (t.type === 'income' && t.accountId && runningAccountBalances[t.accountId] !== undefined) {
          const account = accountMap.get(t.accountId);
          if (account?.type !== 'card') { // Income doesn't go to cards
            runningAccountBalances[t.accountId] += t.amount;
          }
      // Expense
      } else if (t.type === 'expense') {
        if (t.paymentMethod === 'online' && t.accountId && runningAccountBalances[t.accountId] !== undefined) {
            const account = accountMap.get(t.accountId);
            if (account?.type === 'card') {
              runningAccountBalances[t.accountId] -= t.amount; // For cards, balance is what you owe, so it's negative
            } else {
              runningAccountBalances[t.accountId] -= t.amount;
            }
        } else if (t.paymentMethod === 'cash') {
          runningCashBalance -= t.amount;
        } else if (t.paymentMethod === 'digital') {
          runningDigitalBalance -= t.amount;
        }
      // Transfer
      } else if (t.type === 'transfer') {
        // From account
        if (t.fromAccountId && runningAccountBalances[t.fromAccountId] !== undefined) {
          const fromAccount = accountMap.get(t.fromAccountId);
          if (fromAccount?.type === 'card') {
            runningAccountBalances[t.fromAccountId] -= t.amount; // Cash advance increases debt (more negative)
          } else {
            runningAccountBalances[t.fromAccountId] -= t.amount;
          }
        } else if (t.fromAccountId === 'cash-wallet') {
          runningCashBalance -= t.amount;
        } else if (t.fromAccountId === 'digital-wallet') {
          runningDigitalBalance -= t.amount;
        }

        // To account
        if (t.toAccountId && runningAccountBalances[t.toAccountId] !== undefined) {
          const toAccount = accountMap.get(t.toAccountId);
          if (toAccount?.type === 'card') {
            runningAccountBalances[t.toAccountId] += t.amount; // Paying off card decreases debt (less negative)
          } else {
            runningAccountBalances[t.toAccountId] += t.amount;
          }
        } else if (t.toAccountId === 'cash-wallet') {
          runningCashBalance += t.amount;
        } else if (t.toAccountId === 'digital-wallet') {
          runningDigitalBalance += t.amount;
        }
      }
    });

    const finalAccounts = rawAccounts.map(acc => {
        return {
          ...acc,
          balance: runningAccountBalances[acc.id] ?? 0,
        };
    });
    
    // --- Calculate running balance for the transaction table ---
    const runningBalances = new Map<string, number>();
    if (activeTab) {
        let runningBalance = 0;
        const activeAccount = rawAccounts.find(a => a.id === activeTab);
        const isPrimaryView = primaryAccount?.id === activeTab;

        chronologicalTransactions.forEach(t => {
            let effect = 0;
            const isCard = activeAccount?.type === 'card';

            if (isPrimaryView) {
                const isToPrimaryEcosystem = t.toAccountId === primaryAccount?.id || t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
                const isFromPrimaryEcosystem = t.fromAccountId === primaryAccount?.id || t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
                const creditCardIds = rawAccounts.filter(a => a.type === 'card').map(a => a.id);
                const isCreditCardExpense = t.type === 'expense' && t.accountId && creditCardIds.includes(t.accountId);

                if (t.type === 'income' && isToPrimaryEcosystem) {
                    effect = t.amount;
                } else if (t.type === 'expense' && !isCreditCardExpense) {
                    if (t.paymentMethod === 'online' && t.accountId === primaryAccount?.id) { effect = -t.amount; } 
                    else if (t.paymentMethod === 'cash') { effect = -t.amount; }
                    else if (t.paymentMethod === 'digital') { effect = -t.amount; }
                } else if (t.type === 'transfer') {
                    if (isFromPrimaryEcosystem && !isToPrimaryEcosystem) { effect = -t.amount; }
                    else if (!isFromPrimaryEcosystem && isToPrimaryEcosystem) { effect = t.amount; }
                }
            } else if (isCard) {
                if (t.type === 'expense' && t.accountId === activeTab) { effect = -t.amount; } // increases due
                else if (t.type === 'transfer' && t.toAccountId === activeTab) { effect = t.amount; } // payment decreases due
                else if (t.type === 'transfer' && t.fromAccountId === activeTab) { effect = -t.amount; } // cash advance increases due
            } else { // Regular bank account
                if (t.type === 'income' && t.accountId === activeTab) { effect = t.amount; }
                else if (t.type === 'expense' && t.accountId === activeTab) { effect = -t.amount; }
                else if (t.type === 'transfer') {
                    if (t.fromAccountId === activeTab) { effect = -t.amount; }
                    if (t.toAccountId === activeTab) { effect = t.amount; }
                }
            }
            runningBalance += effect;
            runningBalances.set(t.id, runningBalance);
        });
    }

    return { 
      accounts: finalAccounts, 
      cashWalletBalance: runningCashBalance,
      digitalWalletBalance: runningDigitalBalance,
      transactionBalanceMap: runningBalances
    };
  }, [rawAccounts, allTransactions, walletPreferences, activeTab, primaryAccount]);

  useEffect(() => {
    if (primaryAccount && !activeTab) {
      setActiveTab(primaryAccount.id);
    }
  }, [primaryAccount, activeTab]);

  const creditCards = useMemo(() => accounts.filter(account => account.type === 'card'), [accounts]);
  const sbiCreditCard = useMemo(() => creditCards.find(card => card.name.toLowerCase().includes('sbi credit card')), [creditCards]);
  const otherCreditCards = useMemo(() => creditCards.filter(card => !sbiCreditCard || card.id !== sbiCreditCard.id), [creditCards, sbiCreditCard]);

  const bankAccounts = useMemo(() => accounts.filter(account => account.type !== 'card' && !account.isPrimary), [accounts]);
  
  const secondaryAccounts = useMemo(() => bankAccounts.filter(account => (account.name.toLowerCase().includes('hdfc') || account.name.toLowerCase().includes('fed') || account.name.toLowerCase().includes('post') || account.name.toLowerCase().includes('money'))), [bankAccounts]);
  const otherAccounts = useMemo(() => bankAccounts.filter(account => !secondaryAccounts.some(sa => sa.id === account.id)), [bankAccounts, secondaryAccounts]);

  const getAccountName = useCallback((accountId?: string, paymentMethod?: Transaction['paymentMethod']) => {
    if (accountId === 'cash-wallet' || paymentMethod === 'cash') return "Cash Wallet";
    if (accountId === 'digital-wallet' || paymentMethod === 'digital') return "Digital Wallet";

    if (accountId?.startsWith('loan-virtual-account-')) {
        const personName = accountId.replace('loan-virtual-account-', '').replace(/-/g, ' ');
        const loan = loans.find(l => l.personName.toLowerCase() === personName.toLowerCase());
        if (loan) return loan.personName;
        return personName;
    }

    if (!accountId) return "-";
    
    const account = accounts.find((a) => a.id === accountId);
    if (!account) {
         const loan = loans.find(l => l.id === accountId);
         if (loan) return loan.personName;
         return "N/A";
    }
    
    return account.name;
  }, [accounts, loans]);


  const getLoanDisplayInfo = useMemo(() => {
    return (t: Transaction) => {
        const defaultInfo = { isLoan: false, type: t.type, category: t.category, description: t.description, descriptionClassName: "" };

        if (t.type === 'transfer') {
            if (t.loanTransactionId) {
                const loan = loans.find(l => l.transactions.some(lt => lt.id === t.loanTransactionId));
        
                if (loan) {
                    const loanTx = loan.transactions.find(lt => lt.id === t.loanTransactionId)!;
                    const otherPartyName = loan.personName;
                    
                    const isLoanTaken = loan.type === 'taken';
                    const isRepayment = loanTx.type === 'repayment';
                    let descriptionPrefix = '';

                    if (isLoanTaken) {
                        descriptionPrefix = isRepayment ? 'Repayment to' : 'Loan from';
                    } else { // 'given'
                        descriptionPrefix = isRepayment ? 'Repayment from' : 'Loan to';
                    }
                    
                    const description = `${descriptionPrefix} ${otherPartyName}`;
                    return { isLoan: true, type: loanTx.type, category: 'Loan', description, descriptionClassName: 'text-orange-600 font-bold' };
                }
            }

            const fromIsPrimaryBank = rawAccounts.find(a => a.isPrimary)?.id === t.fromAccountId;
            const toIsPrimaryBank = rawAccounts.find(a => a.isPrimary)?.id === t.toAccountId;

            const fromIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
            const toIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';

            if (fromIsPrimaryBank && toIsWallet) {
                const toWalletName = t.toAccountId === 'cash-wallet' ? 'Cash' : 'Digital';
                const description = `Issue to ${toWalletName} Wallet`;
                return { ...defaultInfo, type: 'issue' as const, description };
            }

            if (fromIsWallet && toIsPrimaryBank) {
                const fromWalletName = t.fromAccountId === 'cash-wallet' ? 'Cash' : 'Digital';
                const description = `Return from ${fromWalletName} Wallet`;
                return { ...defaultInfo, type: 'return' as const, description };
            }
        }
        
        return defaultInfo;
    };
  }, [loans, rawAccounts]);

  const primaryAccountFull = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);

  const filteredTransactions = useMemo(() => {
    const isPrimaryView = primaryAccount?.id === activeTab;
    const creditCardIds = creditCards.map(c => c.id);
    
    const sourceTransactions = allTransactions.filter(t => {
      const fromAccountIsWallet = t.fromAccountId === 'cash-wallet' || t.fromAccountId === 'digital-wallet';
      const toAccountIsWallet = t.toAccountId === 'cash-wallet' || t.toAccountId === 'digital-wallet';
      
      let fromCurrentView: boolean;
      let toCurrentView: boolean;
      let accountIsInView = false;
      
      if (isPrimaryView) {
          fromCurrentView = t.fromAccountId === activeTab || fromAccountIsWallet || (t.fromAccountId ? creditCardIds.includes(t.fromAccountId) : false);
          toCurrentView = t.toAccountId === activeTab || toAccountIsWallet || (t.toAccountId ? creditCardIds.includes(t.toAccountId) : false);
          if (t.type === 'expense' || t.type === 'income') {
              accountIsInView = t.accountId === activeTab || t.paymentMethod === 'cash' || t.paymentMethod === 'digital' || (t.accountId ? creditCardIds.includes(t.accountId) : false);
          }
      } else {
          fromCurrentView = t.fromAccountId === activeTab;
          toCurrentView = t.toAccountId === activeTab;
          if (t.type === 'expense' || t.type === 'income') {
            accountIsInView = t.accountId === activeTab;
          }
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
      filtered = filtered.filter(t => {
        const loanInfo = getLoanDisplayInfo(t);
        const accountName = t.type === 'transfer' ? `${getAccountName(t.fromAccountId)} -> ${getAccountName(t.toAccountId)}` : getAccountName(t.accountId, t.paymentMethod);
        const balance = transactionBalanceMap.get(t.id);
        const balanceString = balance !== undefined ? formatCurrency(balance) : '';
        const amountString = formatCurrency(t.amount);

        const description = loanInfo.description || t.description;
        const category = loanInfo.category || t.category;

        return (
            (t.date && format(new Date(t.date), 'dd/MM/yy').toLowerCase().includes(lowercasedQuery)) ||
            (description && description.toLowerCase().includes(lowercasedQuery)) ||
            (loanInfo.type && loanInfo.type.toLowerCase().includes(lowercasedQuery)) ||
            (accountName && accountName.toLowerCase().includes(lowercasedQuery)) ||
            (category && category.toLowerCase().includes(lowercasedQuery)) ||
            (t.subcategory && t.subcategory.toLowerCase().includes(lowercasedQuery)) ||
            (amountString && amountString.toLowerCase().includes(lowercasedQuery)) ||
            (balanceString && balanceString.toLowerCase().includes(lowercasedQuery)) ||
            (t.amount && t.amount.toString().includes(lowercasedQuery))
        );
      });
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) {
          return dateB - dateA;
      }
      return b.amount - a.amount;
    });
  }, [allTransactions, activeTab, startDate, endDate, searchQuery, primaryAccount, getLoanDisplayInfo, getAccountName, transactionBalanceMap, loans, creditCards]);

    const transactionsWithRunningBalance = useMemo(() => {
        return filteredTransactions.map(transaction => {
            return { ...transaction, balance: transactionBalanceMap.get(transaction.id) ?? 0 };
        });
    }, [filteredTransactions, transactionBalanceMap]);

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
        <Skeleton className="h-[calc(100vh_-_22rem)] w-full" />
      </div>
    );
  }

  
  const getBalanceDifference = (calculatedBalance: number, actualBalance?: number | null) => {
      if (actualBalance === undefined || actualBalance === null) return null;
      const effectiveCalculated = calculatedBalance;
      let diff = effectiveCalculated - actualBalance;
      if (Math.abs(diff) < 0.01) diff = 0;
      return diff;
  }
  
  const cashBalanceDifference = getBalanceDifference(cashWalletBalance, walletPreferences.cash?.balance);
  const digitalBalanceDifference = getBalanceDifference(digitalWalletBalance, walletPreferences.digital?.balance);
  
  const primaryAccountBalanceDifference = primaryAccountFull ? getBalanceDifference(primaryAccountFull.balance, primaryAccountFull.actualBalance) : null;
  const allBalance = (primaryAccountFull ? primaryAccountFull.balance : 0) + cashWalletBalance + digitalWalletBalance + (creditCards.reduce((sum, card) => sum + card.balance, 0));
  
  const accountDataForDialog = [
    { id: 'cash-wallet', name: 'Cash Wallet', balance: cashWalletBalance },
    { id: 'digital-wallet', name: 'Digital Wallet', balance: digitalWalletBalance },
    ...accounts,
  ];

  const handleAccountClick = (accountOrWallet: Account | WalletType, name?: string) => {
    let accountDetails: AccountForDetails | null = null;
    if (typeof accountOrWallet === 'string') { // 'cash-wallet' or 'digital-wallet'
        accountDetails = {
            id: accountOrWallet,
            name: name || (accountOrWallet === 'cash-wallet' ? 'Cash Wallet' : 'Digital Wallet'),
            balance: accountOrWallet === 'cash-wallet' ? cashWalletBalance : digitalWalletBalance,
            walletPreferences: walletPreferences
        };
    } else {
        accountDetails = {
            ...accountOrWallet
        };
    }
    
    setSelectedAccountForDetails(accountDetails);
    setIsDetailsDialogOpen(true);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 p-4 border-b print-hide">
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
        <div className="space-y-1 flex-grow">
            <Label htmlFor="search-input" className="text-xs">Search Transactions</Label>
            <div className="relative">
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
        <div className="space-y-1 flex-grow">
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
        <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleClearFilters} variant="outline" size="icon" className="h-9 w-9">
                <XCircle className="h-4 w-4" />
            </Button>
              <Button onClick={handlePrint} variant="outline" size="icon" className="h-9 w-9">
                <Printer className="h-4 w-4" />
            </Button>
            <AddTransactionDialog accounts={accountDataForDialog}>
                <Button className="w-24">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add
                </Button>
            </AddTransactionDialog>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-auto p-0 bg-transparent print-hide">
            {primaryAccountFull && (
                <TabsTrigger value={primaryAccountFull.id} asChild>
                  <div className={cn("lg:col-span-2 border rounded-lg p-4 cursor-pointer transition-shadow w-full h-full text-left", activeTab === primaryAccountFull.id ? "bg-lime-100/50 dark:bg-lime-900/50 ring-2 ring-primary shadow-lg" : "bg-card")}>
                      <h3 className="font-semibold text-lg mb-2">Primary ({primaryAccountFull.name})</h3>
                      <div className="text-right mb-4">
                        <span className="font-bold text-xl text-green-600">{formatCurrency(allBalance)}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          {/* Bank Balance */}
                          <div className="space-y-1">
                              <Label className="text-sm">Bank Balance</Label>
                              <p 
                                  className="font-bold text-lg cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); if(primaryAccountFull) handleAccountClick(primaryAccountFull); }}
                              >
                                  {formatCurrency(primaryAccountFull.balance)}
                              </p>
                              <Input
                                  type="number"
                                  placeholder="Actual"
                                  className="hide-number-arrows h-8 mt-1 text-sm text-left bg-background"
                                  defaultValue={primaryAccountFull.actualBalance ?? ''}
                                  onChange={(e) => {
                                      const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                      debouncedUpdateAccount(primaryAccountFull.id, { actualBalance: value });
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

                          {/* Digital */}
                          <div className="space-y-1">
                              <Label className="text-sm">Digital</Label>
                              <p 
                                  className="font-bold text-lg cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); handleAccountClick('digital-wallet'); }}
                              >
                                  {formatCurrency(digitalWalletBalance)}
                              </p>
                              <Input
                                  type="number"
                                  placeholder="Actual"
                                  className="hide-number-arrows h-8 text-left text-sm bg-background"
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

                          {/* Cash */}
                          <div className="space-y-1">
                              <Label className="text-sm">Cash</Label>
                              <p 
                                  className="font-bold text-lg cursor-pointer hover:underline"
                                  onClick={(e) => { e.stopPropagation(); handleAccountClick('cash-wallet'); }}
                              >
                                  {formatCurrency(cashWalletBalance)}
                              </p>
                              <Input
                                  type="number"
                                  placeholder="Actual"
                                  className="hide-number-arrows h-8 text-left text-sm bg-background"
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
                          
                          {/* SBI Credit Card Column */}
                          {sbiCreditCard && (() => {
                              const balanceDifference = getBalanceDifference(sbiCreditCard.balance, sbiCreditCard.actualBalance);
                              return (
                                  <div className="space-y-1">
                                      <Label className="text-sm">{sbiCreditCard.name}</Label>
                                      <p 
                                      className="font-bold text-lg cursor-pointer hover:underline"
                                      onClick={(e) => { e.stopPropagation(); if(sbiCreditCard) handleAccountClick(sbiCreditCard); }}
                                      >
                                          {formatCurrency(sbiCreditCard.balance)}
                                      </p>
                                      <Input
                                          type="number"
                                          placeholder="Actual Due"
                                          className="hide-number-arrows h-8 mt-1 text-sm text-left bg-background"
                                          defaultValue={sbiCreditCard.actualBalance ?? ''}
                                          onChange={(e) => {
                                              const value = e.target.value === '' ? null : parseFloat(e.target.value);
                                              debouncedUpdateAccount(sbiCreditCard.id, { actualBalance: value });
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                      />
                                      {balanceDifference !== null && (
                                          <p className={cn("text-xs font-medium pt-1", Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600")}>
                                              Diff: {formatCurrency(balanceDifference)}
                                          </p>
                                      )}
                                  </div>
                              );
                          })()}
                      </div>
                  </div>
                </TabsTrigger>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {otherCreditCards.map((account, index) => {
                    const balanceDifference = getBalanceDifference(account.balance, account.actualBalance);
                    return (
                         <TabsTrigger key={account.id} value={account.id} asChild>
                            <div 
                                className={cn(
                                    "rounded-lg border flex flex-col p-3 items-start text-left gap-1 cursor-pointer transition-shadow h-full", 
                                    activeTab === account.id ? "shadow-lg ring-2 ring-primary" : "",
                                    tabColors[index % tabColors.length], 
                                    textColors[index % textColors.length]
                                )}
                            >
                                <div className="w-full flex justify-between items-start">
                                    <span className="font-semibold text-base">{account.name}</span>
                                    <span onClick={(e) => { e.stopPropagation(); handleAccountClick(account); }} className="font-bold text-lg cursor-pointer hover:underline">{formatCurrency(account.balance)}</span>
                                </div>
                                <div className="w-full mt-auto space-y-1 pt-2">
                                    <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor={`actual-balance-${account.id}`} className="text-sm flex-shrink-0">Actual Due</Label>
                                    <Input
                                        id={`actual-balance-${account.id}`}
                                        type="number"
                                        placeholder="Actual"
                                        className="hide-number-arrows h-8 text-sm w-24 text-right bg-card"
                                        defaultValue={account.actualBalance ?? ''}
                                        onChange={(e) => {
                                            const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                            debouncedUpdateAccount(account.id, { actualBalance: value });
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    </div>
                                    {balanceDifference !== null && (
                                        <div className="w-full text-right mt-1">
                                            <p className={cn(
                                                "text-xs font-medium",
                                                Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                                            )}>
                                                Diff: {formatCurrency(balanceDifference)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsTrigger>
                    )
                })}
                 {[...secondaryAccounts, ...otherAccounts].map((account, index) => {
                    const balanceDifference = getBalanceDifference(account.balance, account.actualBalance);
                    return (
                         <TabsTrigger key={account.id} value={account.id} asChild>
                             <div 
                                className={cn(
                                    "rounded-lg border flex flex-col p-3 items-start text-left gap-1 cursor-pointer transition-shadow h-full", 
                                    activeTab === account.id ? "shadow-lg ring-2 ring-primary" : "",
                                    tabColors[(creditCards.length + index) % tabColors.length], 
                                    textColors[(creditCards.length + index) % textColors.length]
                                )}
                            >
                                <div className="w-full flex justify-between items-start">
                                    <span className="font-semibold text-base">{account.name}</span>
                                    <span onClick={(e) => { e.stopPropagation(); handleAccountClick(account); }} className="font-bold text-lg cursor-pointer hover:underline">{formatCurrency(account.balance)}</span>
                                </div>
                                <div className="w-full mt-auto space-y-1 pt-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor={`actual-balance-${account.id}`} className="text-sm flex-shrink-0">Actual</Label>
                                        <Input
                                            id={`actual-balance-${account.id}`}
                                            type="number"
                                            placeholder="Actual"
                                            className="hide-number-arrows h-8 text-sm w-24 text-right bg-card"
                                            defaultValue={account.actualBalance ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value === '' ? null : parseFloat(e.target.value)
                                                debouncedUpdateAccount(account.id, { actualBalance: value });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    {balanceDifference !== null && (
                                        <div className="w-full text-right mt-1">
                                            <p className={cn(
                                                "text-xs font-medium",
                                                Math.abs(balanceDifference) < 0.01 ? "text-green-600" : "text-red-600"
                                            )}>
                                                Diff: {formatCurrency(balanceDifference)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </TabsTrigger>
                )})}
            </div>
        </TabsList>
      </Tabs>
      
      <Card>
        <div className="relative h-[calc(100vh_-_22rem)] overflow-auto">
          <TransactionTable 
              transactions={pagedTransactions} 
              accountId={activeTab || ''}
              primaryAccount={primaryAccount}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
          />
        </div>
          {totalPages > 1 && (
              <CardFooter className="justify-center border-t p-4 print-hide">
                <PaginationControls currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage as (page: number) => void} />
              </CardFooter>
          )}
      </Card>
      
      <AccountDetailsDialog
        account={selectedAccountForDetails}
        transactions={allTransactions}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      />
    </div>
  );
}

    