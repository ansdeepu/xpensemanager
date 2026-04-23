
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, HandCoins, Info, Trash2, Pencil } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc, orderBy } from "firebase/firestore";
import { format, parseISO, isValid, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan, LoanTransaction, Account, Transaction, Category } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuthState } from "@/hooks/use-auth-state";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const formatCurrency = (amount: number) => {
  let val = amount;
  if (Object.is(val, -0)) val = 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const evaluateMath = (expression: string): number | null => {
  try {
    if (/[^0-9+\-*/.() ]/.test(expression)) {
      return null;
    }
    const result = eval(expression);
    if (typeof result === 'number' && isFinite(result)) {
      return result;
    }
    return null;
  } catch (error) {
    return null;
  }
};

function LoanAccordionItem({ 
    loan, 
    loanType,
    accounts,
    onEditTransaction, 
    onDeleteLoan, 
    onDeleteTransaction,
    onEditLoanName,
    startDate,
    endDate,
    allowedAccountIds
}: { 
    loan: Loan;
    loanType: "taken" | "given";
    accounts: Omit<Account, 'balance'>[];
    onEditTransaction: (loan: Loan, transaction: LoanTransaction) => void;
    onDeleteLoan: (loan: Loan) => void;
    onDeleteTransaction: (loan: Loan, transaction: LoanTransaction) => void;
    onEditLoanName: (loan: Loan) => void;
    startDate?: string;
    endDate?: string;
    allowedAccountIds?: string[];
}) {
    const getAccountName = (accId?: string) => {
        if (accId === 'cash-wallet') return "Cash Wallet";
        if (accId === 'digital-wallet') return "Digital Wallet";
        if (!accId) return "-";
        const account = accounts.find((a) => a.id === accId);
        return account ? account.name : "N/A";
    };

    const { transactionsForPeriod, periodTotals, overallBalanceForTab } = useMemo(() => {
        const rawTransactions = loan.transactions || [];
        // Filter transactions strictly by the allowed accounts for this tab
        const tabFilteredTransactions = allowedAccountIds 
            ? rawTransactions.filter(t => allowedAccountIds.includes(t.accountId))
            : rawTransactions;

        const allTransactions = [...tabFilteredTransactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        let runningBalance = 0;
        const processedTransactions = allTransactions.map(transaction => {
            let credit = 0;
            let debit = 0;
            let effect = 0;
            if (loan.type === 'taken') {
                if (transaction.type === 'loan') { 
                    credit = transaction.amount; 
                    effect = transaction.amount;
                } else { 
                    debit = transaction.amount; 
                    effect = -transaction.amount;
                }
            } else { // 'given'
                if (transaction.type === 'loan') { 
                    debit = transaction.amount; 
                    effect = transaction.amount;
                } else { 
                    credit = transaction.amount; 
                    effect = -transaction.amount;
                }
            }
            runningBalance += effect;
            return { ...transaction, credit, debit, runningBalance };
        });

        const overallBalanceForTab = runningBalance;

        const interval = startDate && endDate ? { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) } : null;
        
        const filteredTransactions = processedTransactions.filter(t => {
            if (!interval) return true;
            const transactionDate = parseISO(t.date);
            return isValid(transactionDate) && isWithinInterval(transactionDate, interval);
        }).reverse();

        const totalLoan = filteredTransactions.reduce((sum, t) => sum + (t.type === 'loan' ? t.amount : 0), 0);
        const totalRepayment = filteredTransactions.reduce((sum, t) => sum + (t.type === 'repayment' ? t.amount : 0), 0);

        return {
            transactionsForPeriod: filteredTransactions,
            periodTotals: { totalLoan, totalRepayment },
            overallBalanceForTab
        };
    }, [loan, startDate, endDate, allowedAccountIds]);

    const getLoanTransactionDescription = (loan: Loan, transaction: LoanTransaction) => {
        if (transaction.description != null && transaction.description.trim() !== '') return transaction.description;

        if (loan.type === 'given') {
            return transaction.type === 'loan' ? `Loan to ${loan.personName}` : `Repayment from ${loan.personName}`;
        } else { // loan.type === 'taken'
            return transaction.type === 'loan' ? `Loan from ${loan.personName}` : `Repayment to ${loan.personName}`;
        }
    };

    return (
        <AccordionItem value={loan.id}>
            <AccordionTrigger>
                <div className="grid grid-cols-3 w-full items-center text-left">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-base">{loan.personName}</span>
                    </div>
                    <div className="text-center">
                        <Badge variant={overallBalanceForTab > 0 ? (loan.type === 'taken' ? 'destructive' : 'default') : 'outline'} className={cn("text-sm", overallBalanceForTab > 0 && loan.type === 'given' && "bg-green-600 hover:bg-green-700")}>{formatCurrency(overallBalanceForTab)}</Badge>
                    </div>
                    <div></div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex justify-center px-4 pb-4">
                    <Card className="bg-muted/50 w-full lg:w-3/4">
                        <CardHeader className="pb-2 flex-row justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CardDescription className="flex gap-4">
                                    <span>Total Loan (Period): <span className="font-semibold text-foreground">{formatCurrency(periodTotals.totalLoan)}</span></span>
                                    <span>Total Repayment (Period): <span className="font-semibold text-foreground">{formatCurrency(periodTotals.totalRepayment)}</span></span>
                                </CardDescription>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEditLoanName(loan); }}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex items-center">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will delete all loan records for {loan.personName} and cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => onDeleteLoan(loan)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="px-2 py-1">Date</TableHead>
                                            <TableHead className="px-2 py-1">Type</TableHead>
                                            <TableHead className="px-2 py-1">Account</TableHead>
                                            <TableHead className="px-2 py-1">Description</TableHead>
                                            {loanType === 'taken' ? (
                                            <>
                                                <TableHead className="text-right px-2 py-1">Loan taken</TableHead>
                                                <TableHead className="text-right px-2 py-1">Repayment</TableHead>
                                            </>
                                            ) : (
                                            <>
                                                <TableHead className="text-right px-2 py-1">Repayment</TableHead>
                                                <TableHead className="text-right px-2 py-1">Loan Given</TableHead>
                                            </>
                                            )}
                                            <TableHead className="text-right px-2 py-1">Balance</TableHead>
                                            <TableHead className="text-right px-2 py-1">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactionsForPeriod.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell className="px-2 py-1 text-xs">{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                <TableCell className="px-2 py-1">
                                                    <Badge variant={t.type === 'loan' ? 'outline' : 'secondary'} className="capitalize text-[10px] px-1.5 py-0">{t.type}</Badge>
                                                </TableCell>
                                                <TableCell className="px-2 py-1 text-xs font-medium">{getAccountName(t.accountId)}</TableCell>
                                                <TableCell className="px-2 py-1 text-xs">{getLoanTransactionDescription(loan, t)}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600 px-2 py-1 text-xs">
                                                    {t.credit > 0 ? formatCurrency(t.credit) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600 px-2 py-1 text-xs">
                                                    {t.debit > 0 ? formatCurrency(t.debit) : null}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-mono px-2 py-1 text-xs", 
                                                    loanType === 'taken' 
                                                        ? (t.runningBalance > 0 ? "text-red-600" : "text-green-600")
                                                        : (t.runningBalance > 0 ? "text-green-600" : "text-red-600")
                                                )}>
                                                    {formatCurrency(t.runningBalance)}
                                                </TableCell>
                                                <TableCell className="text-right px-2 py-1">
                                                    <div className="flex items-center justify-end">
                                                        <Button variant="ghost" size="icon" onClick={() => onEditTransaction(loan, t)} className="h-7 w-7">
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                    <AlertDialogDescription>This will delete this transaction and cannot be undone.</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => onDeleteTransaction(loan, t)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AccordionContent>
        </AccordionItem>
    )
}

function CardAccordionItem({
    card,
    accounts,
    transactions,
    startDate,
    endDate,
    onEditTransaction,
    onDeleteTransaction,
}: {
    card: Account;
    accounts: Omit<Account, 'balance'>[];
    transactions: Transaction[];
    startDate?: string;
    endDate?: string;
    onEditTransaction: (transaction: Transaction) => void;
    onDeleteTransaction: (transaction: Transaction) => void;
}) {
    const getAccountName = (accId?: string) => {
        if (accId === 'cash-wallet') return "Cash Wallet";
        if (accId === 'digital-wallet') return "Digital Wallet";
        if (!accId) return "-";
        const account = accounts.find((a) => a.id === accId);
        return account ? account.name : "N/A";
    };

    const { transactionsForPeriod, periodTotals } = useMemo(() => {
        const allCardTransactions = (transactions || [])
            .filter(t =>
                (t.type === 'expense' && t.accountId === card.id) ||
                (t.type === 'transfer' && (t.toAccountId === card.id || t.fromAccountId === card.id))
            )
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        let runningBalance = 0;
        const processedTransactions = allCardTransactions.map(t => {
            let charge = 0;
            let payment = 0;
            let effect = 0;

            if (t.type === 'expense' && t.accountId === card.id) {
                charge = t.amount;
                effect = t.amount;
            } else if (t.type === 'transfer') {
                if (t.toAccountId === card.id) {
                    payment = t.amount;
                    effect = -t.amount;
                } else if (t.fromAccountId === card.id) {
                    charge = t.amount;
                    effect = t.amount;
                }
            }
            runningBalance += effect;
            return { ...t, charge, payment, runningBalance };
        });

        const interval = startDate && endDate ? { start: startOfDay(new Date(startDate)), end: endOfDay(new Date(endDate)) } : null;
        
        const filteredTransactions = processedTransactions.filter(t => {
            if (!interval) return true;
            const transactionDate = parseISO(t.date);
            return isValid(transactionDate) && isWithinInterval(transactionDate, interval);
        }).reverse();
        
        const totalCharges = filteredTransactions.reduce((sum, t) => sum + t.charge, 0);
        const totalPayments = filteredTransactions.reduce((sum, t) => sum + t.payment, 0);

        return {
            transactionsForPeriod: filteredTransactions,
            periodTotals: { totalCharges, totalPayments }
        };
    }, [transactions, card, startDate, endDate]);

    return (
        <AccordionItem value={card.id}>
            <AccordionTrigger>
                <div className="grid grid-cols-3 w-full items-center text-left">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-base">{card.name}</span>
                    </div>
                    <div className="text-center">
                        <Badge variant={'destructive'} className="text-sm">{formatCurrency(card.balance)}</Badge>
                    </div>
                    <div className="text-right pr-4">
                      <Badge variant="secondary">Credit Card</Badge>
                    </div>
                 </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex justify-center px-4 pb-4">
                    <Card className="bg-muted/50 w-full lg:w-3/4">
                        <CardHeader className="pb-2 flex-row justify-between items-center">
                             <CardDescription className="flex gap-4">
                                <span>Charges (Period): <span className="font-semibold text-red-600">{formatCurrency(periodTotals.totalCharges)}</span></span>
                                <span>Payments (Period): <span className="font-semibold text-green-600">{formatCurrency(periodTotals.totalPayments)}</span></span>
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="w-full overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="px-2 py-1">Date</TableHead>
                                            <TableHead className="px-2 py-1">Account</TableHead>
                                            <TableHead className="px-2 py-1">Description</TableHead>
                                            <TableHead className="text-right px-2 py-1">Charges</TableHead>
                                            <TableHead className="text-right px-2 py-1">Payments</TableHead>
                                            <TableHead className="text-right px-2 py-1">Balance</TableHead>
                                            <TableHead className="text-right px-2 py-1">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactionsForPeriod.length > 0 ? transactionsForPeriod.map(t => {
                                            const otherAccountName = t.type === 'transfer' 
                                                ? (t.toAccountId === card.id ? getAccountName(t.fromAccountId) : getAccountName(t.toAccountId))
                                                : "Self";
                                            return (
                                            <TableRow key={t.id}>
                                                <TableCell className="px-2 py-1 text-xs">{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                <TableCell className="px-2 py-1 text-xs font-medium">{otherAccountName}</TableCell>
                                                <TableCell className="px-2 py-1 text-xs">{t.description}</TableCell>
                                                <TableCell className="text-right font-mono text-red-600 px-2 py-1 text-xs">
                                                    {t.charge > 0 ? formatCurrency(t.charge) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-green-600 px-2 py-1 text-xs">
                                                    {t.payment > 0 ? formatCurrency(t.payment) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono px-2 py-1 text-xs text-red-600">
                                                    {formatCurrency(t.runningBalance)}
                                                </TableCell>
                                                <TableCell className="text-right px-2 py-1">
                                                  <div className="flex items-center justify-end">
                                                    <Button variant="ghost" size="icon" onClick={() => onEditTransaction(t)} className="h-7 w-7">
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                <AlertDialogDescription>This will delete this transaction and cannot be undone.</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => onDeleteTransaction(t)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                  </div>
                                                </TableCell>
                                            </TableRow>
                                        )}) : (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                                    No transactions found for this card in the selected period.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

export function LoanList({ 
    loanType, 
    loans: allLoans, 
    creditCards, 
    transactions: allTransactions, 
    startDate, 
    endDate,
    allowedAccountIds
}: { 
    loanType: "taken" | "given", 
    loans: Loan[], 
    creditCards?: Account[], 
    transactions?: Transaction[], 
    startDate?: string, 
    endDate?: string,
    allowedAccountIds?: string[]
}) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditLoanNameDialogOpen, setIsEditLoanNameDialogOpen] = useState(false);
  const [isEditCardTxDialogOpen, setIsEditCardTxDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<LoanTransaction | null>(null);
  const [selectedCardTransaction, setSelectedCardTransaction] = useState<Transaction | null>(null);
  const [user, loading] = useAuthState();
  const [clientLoaded, setClientLoaded] = useState(false);
  const { toast } = useToast();

  const [editAmount, setEditAmount] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string | undefined>();
  const [editSubCategory, setEditSubCategory] = useState<string | undefined>();

  const [personName, setPersonName] = useState("");
  const [isNewPerson, setIsNewPerson] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<'loan' | 'repayment'>('loan');
  const [activeAddTab, setActiveAddTab] = useState("loan");

  // Deduplicate Loans: Remove entries that are actually credit cards which are handled separately
  const filteredLoans = useMemo(() => {
    if (!allLoans) return [];
    const cardNames = new Set(creditCards?.map(c => c.name.toLowerCase()) || []);
    return allLoans.filter(l => !cardNames.has(l.personName.toLowerCase()));
  }, [allLoans, creditCards]);

  useEffect(() => {
    setClientLoaded(true);
    if(filteredLoans) {
        setLoans(filteredLoans);
    }
  }, [filteredLoans]);

  useEffect(() => {
    if (user && db) {
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
          setAccounts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Omit<Account, 'balance'>));
      });
      
      const categoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
      });

      return () => {
        unsubscribeAccounts();
        unsubscribeCategories();
      };
    }
  }, [user]);

  const editSubcategories = useMemo(() => {
    if (!editCategory) return [];
    const category = categories.find(c => c.id === editCategory);
    return category?.subcategories || [];
  }, [editCategory, categories]);

  const editCategoriesForDropdown = useMemo(() => {
    if (!selectedCardTransaction || selectedCardTransaction.type !== 'expense') {
        return [];
    }
    return categories.filter(c => c.type === 'expense' || c.type === 'bank-expense');
  }, [categories, selectedCardTransaction]);

  const handleAmountChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };
  
  const handleAmountBlur = (value: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (value.trim() === "") return;
    const result = evaluateMath(value);
    if (result !== null) {
      setter(String(result));
    }
  };

  const resetAddDialog = () => {
    setIsNewPerson(false);
    setPersonName("");
    setSelectedPersonId(null);
    setTransactionType('loan');
    setActiveAddTab("loan");
  }

  const handleCardAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const formData = new FormData(event.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const cardAccountId = formData.get("cardAccountId") as string;
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
    const adjustmentType = formData.get("adjustmentType") as 'cashback' | 'charge';

    if (!cardAccountId) {
      toast({ variant: "destructive", title: "Please select a credit card." });
      return;
    }

    let transaction: Partial<Transaction>;

    if (adjustmentType === 'cashback') {
      transaction = {
        userId: user.uid,
        date,
        description: description || 'Cash back',
        amount,
        type: 'transfer',
        fromAccountId: 'cashback-source',
        toAccountId: cardAccountId,
        category: 'Cashback',
        paymentMethod: 'online',
      };
    } else {
      transaction = {
        userId: user.uid,
        date,
        description: description || 'Card Charge/Fee',
        amount,
        type: 'expense',
        paymentMethod: 'online',
        accountId: cardAccountId,
        category: 'Bank Charges',
        subcategory: 'Service Charge',
      };
    }

    try {
      await addDoc(collection(db, "transactions"), transaction as Transaction);
      setIsAddDialogOpen(false);
      resetAddDialog();
      toast({ title: "Card adjustment added successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add adjustment", description: error.message });
    }
  };

 const handleAddLoanTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
  
    const formData = new FormData(event.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const myAccountId = formData.get("myAccountId") as string;
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
  
    let otherPartyName: string | undefined;
    let otherPartyAccountIdForTransfer: string | undefined;
    
    const currentPrimaryCreditCard = accounts.find(acc => acc.type === 'card' && acc.name.toLowerCase().includes('sbi'));
    const currentOtherAccounts = accounts.filter(a => (!a.isPrimary && a.type !== 'card') || (currentPrimaryCreditCard && a.id === currentPrimaryCreditCard.id));
    
    // Simplified filtering: don't allow SBI cards in the dropdown if we're technically outside the primary tab? 
    // Actually, the dialog handles all. We'll filter the parties list similarly to LoansPage.
    const allLoanParties: (Loan | Omit<Account, "balance">)[] = [
      ...loans,
      ...currentOtherAccounts
    ];

    if (isNewPerson) {
      otherPartyName = personName;
      otherPartyAccountIdForTransfer = `loan-virtual-account-${otherPartyName.replace(/\s+/g, '-')}`;
    } else if (selectedPersonId) {
        const existingParty = allLoanParties.find(l => l.id === selectedPersonId);
        if (existingParty) {
            if ('personName' in existingParty && existingParty.personName) {
                otherPartyName = existingParty.personName;
                otherPartyAccountIdForTransfer = `loan-virtual-account-${otherPartyName.replace(/\s+/g, '-')}`;
            } else if ('name' in existingParty) {
                otherPartyName = existingParty.name;
                otherPartyAccountIdForTransfer = existingParty.id;
            }
        }
    }


    if (!otherPartyName) {
      toast({ variant: "destructive", title: "Person or account name is required" });
      return;
    }
    
    const newLoanTransaction: LoanTransaction = {
      id: new Date().getTime().toString() + Math.random().toString(36).substring(2, 9),
      date,
      amount,
      accountId: myAccountId,
      description,
      type: transactionType,
    };
  
    try {
      const batch = writeBatch(db);
  
      let loanDocRef;
      let existingLoan = loans.find(l => l.personName.toLowerCase() === otherPartyName?.toLowerCase() && l.type === loanType);
      
      if (existingLoan) {
        loanDocRef = doc(db, "loans", existingLoan.id);
        const existingTransactions = existingLoan.transactions || [];
        batch.update(loanDocRef, { transactions: [...existingTransactions, newLoanTransaction] });
      } else {
        loanDocRef = doc(collection(db, "loans"));
        const newLoanData = {
          userId: user.uid,
          personName: otherPartyName,
          type: loanType,
          transactions: [newLoanTransaction]
        };
        batch.set(loanDocRef, newLoanData);
      }
      
      let fromAccountId: string;
      let toAccountId: string;

      if (loanType === 'taken') {
          fromAccountId = transactionType === 'loan' ? otherPartyAccountIdForTransfer! : myAccountId;
          toAccountId = transactionType === 'loan' ? myAccountId : otherPartyAccountIdForTransfer!;
      } else {
          fromAccountId = transactionType === 'loan' ? myAccountId : otherPartyAccountIdForTransfer!;
          toAccountId = transactionType === 'loan' ? otherPartyAccountIdForTransfer! : myAccountId;
      }
      
      let paymentMethod: 'online' | 'cash' | 'digital' = 'online';
      if (myAccountId === 'cash-wallet') {
        paymentMethod = 'cash';
      } else if (myAccountId === 'digital-wallet') {
        paymentMethod = 'digital';
      }

      const financialTransaction: Partial<Transaction> = {
          userId: user.uid,
          date,
          description: description,
          amount,
          type: 'transfer',
          fromAccountId,
          toAccountId,
          category: 'Loan',
          paymentMethod: paymentMethod,
          loanTransactionId: newLoanTransaction.id,
      };

      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, financialTransaction as any);
  
      await batch.commit();
      setIsAddDialogOpen(false);
      resetAddDialog();
      toast({ title: "Transaction added successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add transaction", description: error.message });
    }
  };

  const handleEditLoanTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedLoan || !selectedTransaction) return;

    const formData = new FormData(event.currentTarget);
    const updatedTransaction = {
      ...selectedTransaction,
      date: formData.get("date") as string,
      amount: parseFloat(formData.get("amount") as string),
      accountId: formData.get("myAccountId") as string,
      description: formData.get("description") as string,
    };

    const newTransactions = selectedLoan.transactions.map(t => 
        t.id === selectedTransaction.id ? updatedTransaction : t
    );

    try {
        const batch = writeBatch(db);
        const loanRef = doc(db, "loans", selectedLoan.id);
        batch.update(loanRef, { transactions: newTransactions });

        const financialTxQuery = query(collection(db, "transactions"), where("userId", "==", user.uid), where("loanTransactionId", "==", selectedTransaction.id));
        const financialTxSnapshot = await getDocs(financialTxQuery);
        
        const otherPartyAccount = accounts.find(acc => acc.name.toLowerCase() === selectedLoan.personName.toLowerCase());
        const otherPartyAccountIdForTransfer = otherPartyAccount 
            ? otherPartyAccount.id 
            : `loan-virtual-account-${selectedLoan.personName.replace(/\s+/g, '-')}`;


        let fromAccountId: string;
        let toAccountId: string;

        if (selectedLoan.type === 'taken') {
            fromAccountId = updatedTransaction.type === 'loan' ? otherPartyAccountIdForTransfer : updatedTransaction.accountId;
            toAccountId = updatedTransaction.type === 'loan' ? updatedTransaction.accountId : otherPartyAccountIdForTransfer;
        } else {
            fromAccountId = updatedTransaction.type === 'loan' ? updatedTransaction.accountId : otherPartyAccountIdForTransfer;
            toAccountId = updatedTransaction.type === 'loan' ? otherPartyAccountIdForTransfer : updatedTransaction.accountId;
        }

        if (!financialTxSnapshot.empty) {
            const financialTxDoc = financialTxSnapshot.docs[0];
            const updatedFinancialData = {
                date: updatedTransaction.date,
                amount: updatedTransaction.amount,
                description: updatedTransaction.description,
                fromAccountId,
                toAccountId,
            };
            batch.update(financialTxDoc.ref, updatedFinancialData);
        } else {
            let paymentMethod: 'online' | 'cash' | 'digital' = 'online';
            if (updatedTransaction.accountId === 'cash-wallet') {
                paymentMethod = 'cash';
            } else if (updatedTransaction.accountId === 'digital-wallet') {
                paymentMethod = 'digital';
            }
            const newFinancialTransaction: Partial<Transaction> = {
                userId: user.uid,
                date: updatedTransaction.date,
                description: updatedTransaction.description,
                amount: updatedTransaction.amount,
                type: 'transfer',
                fromAccountId,
                toAccountId,
                category: 'Loan',
                paymentMethod: paymentMethod,
                loanTransactionId: updatedTransaction.id,
            };

            const transactionRef = doc(collection(db, "transactions"));
            batch.set(transactionRef, newFinancialTransaction as any);
        }

        await batch.commit();
        setIsEditDialogOpen(false);
        toast({ title: "Transaction updated successfully" });
    } catch(error: any) {
        toast({ variant: "destructive", title: "Failed to update transaction", description: error.message });
    }
  };

  const handleEditCardTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedCardTransaction) return;

    const formData = new FormData(event.currentTarget);
    const dateString = formData.get("date") as string;
    const transactionDate = dateString ? new Date(dateString) : new Date();

    const updatedData: Partial<Transaction> = {
      description: formData.get("description") as string,
      amount: parseFloat(editAmount),
      date: transactionDate.toISOString(),
    };

    if (selectedCardTransaction.type === 'expense') {
        const categoryId = formData.get('category') as string;
        const subcategory = formData.get('subcategory') as string;
        const categoryDoc = categories.find(c => c.id === categoryId);
        updatedData.category = categoryDoc?.name || 'Uncategorized';
        updatedData.categoryId = categoryId;
        updatedData.subcategory = subcategory || "";
    }
    
    try {
        await updateDoc(doc(db, "transactions", selectedCardTransaction.id), updatedData);
        setIsEditCardTxDialogOpen(false);
        setSelectedCardTransaction(null);
        toast({ title: "Transaction updated" });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Update failed", description: error.message });
    }
  };


  const handleDeleteLoanTransaction = async (loan: Loan, transactionToDelete: LoanTransaction) => {
    if (!user) return;

    const newTransactions = loan.transactions.filter(t => t.id !== transactionToDelete.id);

    try {
        const batch = writeBatch(db);
        const loanRef = doc(db, "loans", loan.id);

        if (newTransactions.length > 0) {
            batch.update(loanRef, { transactions: newTransactions });
        } else {
            batch.delete(loanRef);
        }

        const financialTxQuery = query(collection(db, "transactions"), where("userId", "==", user.uid), where("loanTransactionId", "==", transactionToDelete.id));
        const querySnapshot = await getDocs(financialTxQuery);
        if (!querySnapshot.empty) {
            const financialTransactionDoc = querySnapshot.docs[0];
            batch.delete(financialTransactionDoc.ref);
        }
        
        await batch.commit();
        toast({ title: "Transaction deleted successfully" });
    } catch(error: any) {
        toast({ variant: "destructive", title: "Failed to delete transaction", description: error.message });
    }
  };

   const handleDeleteCardTransaction = async (transactionToDelete: Transaction) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, "transactions", transactionToDelete.id));
        toast({ title: "Transaction deleted successfully." });
    } catch (error: any) {
        toast({
            variant: "destructive",
            title: "Deletion failed",
            description: error.message || "An unexpected error occurred."
        });
    }
  };
  
  const handleDeleteLoan = async (loan: Loan) => {
    if (!user) return;
    try {
        const batch = writeBatch(db);
        const loanRef = doc(db, "loans", loan.id);
        batch.delete(loanRef);
        
        for (const loanTx of loan.transactions) {
            const financialTxQuery = query(collection(db, "transactions"), where("userId", "==", user.uid), where("loanTransactionId", "==", loanTx.id));
            const querySnapshot = await getDocs(financialTxQuery);
            if (!querySnapshot.empty) {
                const financialTransactionDoc = querySnapshot.docs[0];
                batch.delete(financialTransactionDoc.ref);
            }
        }

        await batch.commit();
        toast({ title: "Loan record deleted successfully" });
    } catch (error: any) {
        toast({ variant: "destructive", title: "Failed to delete loan", description: error.message });
    }
  };

  const handleEditLoanName = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedLoan) return;

    const formData = new FormData(event.currentTarget);
    const newPersonName = formData.get("personName") as string;

    if (!newPersonName || newPersonName.trim() === '') {
        toast({ variant: 'destructive', title: 'Person name cannot be empty' });
        return;
    }

    try {
        const loanRef = doc(db, 'loans', selectedLoan.id);
        await updateDoc(loanRef, { personName: newPersonName });
        setIsEditLoanNameDialogOpen(false);
        setSelectedLoan(null);
        toast({ title: 'Loan updated successfully' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to update loan', description: error.message });
    }
  };

  const openEditDialog = (loan: Loan, transaction: LoanTransaction) => {
    setSelectedLoan(loan);
    setSelectedTransaction(transaction);
    setIsEditDialogOpen(true);
  };
  
  const openEditLoanNameDialog = (loan: Loan) => {
      setSelectedLoan(loan);
      setIsEditLoanNameDialogOpen(true);
  }

  const openEditCardTxDialog = (tx: Transaction) => {
    setSelectedCardTransaction(tx);
    setEditDate(format(new Date(tx.date), 'yyyy-MM-dd'));
    setEditAmount(String(tx.amount));
    setEditDescription(tx.description);
    
    let categoryDoc;
    if (tx.categoryId) {
        categoryDoc = categories.find(c => c.id === tx.categoryId);
    } else if (tx.category) {
        categoryDoc = categories.find(c => c.name === tx.category && (c.type === 'expense' || c.type === 'bank-expense'));
    }
    setEditCategory(categoryDoc?.id);
    setEditSubCategory(tx.subcategory);

    setIsEditCardTxDialogOpen(true);
  };


  const primaryCreditCard = useMemo(() => accounts.find(acc => acc.type === 'card' && acc.name.toLowerCase().includes('sbi')), [accounts]);

  const otherAccountsForSelect = useMemo(() => {
    return accounts.filter(a => (!a.isPrimary && a.type !== 'card') || (primaryCreditCard && a.id === primaryCreditCard.id));
  }, [accounts, primaryCreditCard]);

  const filteredLoansForSelect = useMemo(() => {
    const accountNames = new Set(otherAccountsForSelect.map(a => a.name.toLowerCase()));
    return loans.filter(l => !accountNames.has(l.personName.toLowerCase()));
  }, [loans, otherAccountsForSelect]);

  const sbiCard = useMemo(() => creditCards?.find(c => c.name.toLowerCase().includes('sbi')), [creditCards]);
  const otherCards = useMemo(() => creditCards?.filter(c => c.name.toLowerCase().includes('sbi') === false), [creditCards]);

  if (loading || !clientLoaded) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  const title = loanType === "taken" ? "Loan Taken" : "Loans Given";
  const description =
    loanType === "taken"
      ? "Consolidated view of money you have borrowed and credit card dues."
      : "Consolidated view of money you have lent.";
  
  const allAccountsForTx = [
    { id: 'cash-wallet', name: 'Cash Wallet' },
    { id: 'digital-wallet', name: 'Digital Wallet' },
    ...accounts
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            if (!open) resetAddDialog();
            setIsAddDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-[425px] md:max-w-3xl">
              <Tabs value={activeAddTab} onValueChange={setActiveAddTab}>
                  <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="loan">Loan / Repayment</TabsTrigger>
                      <TabsTrigger value="adjustment">Card Adjustment</TabsTrigger>
                  </TabsList>
                  <TabsContent value="loan" className="mt-0">
                      <form onSubmit={handleAddLoanTransaction}>
                      <DialogHeader className="pt-4">
                          <DialogTitle>Add Loan / Repayment</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label>Select Person / Account</Label>
                              <Select onValueChange={value => {
                                  if (value === 'new') {
                                      setIsNewPerson(true);
                                      setSelectedPersonId(null);
                                      setPersonName("");
                                  } else {
                                      setIsNewPerson(false);
                                      setSelectedPersonId(value);
                                  }
                              }}>
                                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                                  <SelectContent>
                                      {filteredLoansForSelect.length > 0 && (
                                        <SelectGroup>
                                          <SelectLabel>People (Loans)</SelectLabel>
                                          {filteredLoansForSelect.map(l => <SelectItem key={l.id} value={l.id}>{l.personName}</SelectItem>)}
                                        </SelectGroup>
                                      )}
                                      
                                      {otherAccountsForSelect.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel>Your Other Accounts</SelectLabel>
                                            {otherAccountsForSelect.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                        </SelectGroup>
                                      )}
                                      
                                      <SelectGroup>
                                      <SelectItem value="new">Add a new person</SelectItem>
                                      </SelectGroup>
                                  </SelectContent>
                              </Select>
                              </div>
                          {isNewPerson && (
                              <div className="space-y-2">
                                  <Label htmlFor="personName">New Person's Name</Label>
                                  <Input id="personName" name="personName" value={personName} onChange={e => setPersonName(e.target.value)} required />
                              </div>
                          )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                              <Label>Transaction Type</Label>
                              <Select name="transactionType" value={transactionType} onValueChange={(v) => setTransactionType(v as 'loan' | 'repayment')}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="loan">{loanType === 'taken' ? 'I took a loan' : 'I gave a loan'}</SelectItem>
                                      <SelectItem value="repayment">{loanType === 'taken' ? 'I repaid' : 'I received repayment'}</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="amount">Amount</Label>
                              <Input id="amount" name="amount" type="number" step="0.01" required />
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="date">Date</Label>
                              <Input id="date" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                          </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="myAccountId">My Account</Label>
                              <Select name="myAccountId" required>
                                  <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                                  <SelectContent>
                                      {allAccountsForTx.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="description">Description</Label>
                              <Textarea id="description" name="description" placeholder="Optional notes" />
                          </div>
                          </div>
                      </div>
                      <DialogFooter>
                          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                          <Button type="submit">Add Record</Button>
                      </DialogFooter>
                      </form>
                  </TabsContent>
                  <TabsContent value="adjustment" className="mt-0">
                      <form onSubmit={handleCardAdjustment}>
                          <DialogHeader className="pt-4">
                              <DialogTitle>Add Card Adjustment</DialogTitle>
                              <DialogDescription>
                                  Add a cash back or other charge to a credit card.
                              </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <Label htmlFor="cardAccountId">Credit Card</Label>
                                      <Select name="cardAccountId" required>
                                          <SelectTrigger id="cardAccountId"><SelectValue placeholder="Select card..."/></SelectTrigger>
                                          <SelectContent>
                                              {creditCards?.map(card => <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>)}
                                          </SelectContent>
                                      </Select>
                                  </div>
                                  <div className="space-y-2">
                                      <Label>Adjustment Type</Label>
                                      <Select name="adjustmentType" defaultValue="cashback" required>
                                          <SelectTrigger><SelectValue /></SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="cashback">Cash Back (Credit)</SelectItem>
                                              <SelectItem value="charge">Other Charge (Debit)</SelectItem>
                                          </SelectContent>
                                      </Select>
                                  </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <Label htmlFor="amount-adj">Amount</Label>
                                      <Input id="amount-adj" name="amount" type="number" step="0.01" required />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="date-adj">Date</Label>
                                      <Input id="date-adj" name="date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="description-adj">Description</Label>
                                  <Textarea id="description-adj" name="description" placeholder="e.g. Cashback for recent purchase" />
                              </div>
                          </div>
                          <DialogFooter>
                              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                              <Button type="submit">Add Adjustment</Button>
                          </DialogFooter>
                      </form>
                  </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
            {(loans.length === 0 && (!creditCards || creditCards.length === 0)) ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <HandCoins className="h-10 w-10 mb-2" />
                    <p>No debts recorded yet. Click "Add Record" to get started.</p>
                </div>
            ) : (
                <Accordion type="single" collapsible className="w-full">
                    {sbiCard && allTransactions && loanType === 'taken' && (allowedAccountIds?.includes(sbiCard.id)) && (
                        <CardAccordionItem
                            key={sbiCard.id}
                            card={sbiCard}
                            accounts={accounts}
                            transactions={allTransactions}
                            startDate={startDate}
                            endDate={endDate}
                            onEditTransaction={openEditCardTxDialog}
                            onDeleteTransaction={handleDeleteCardTransaction}
                        />
                    )}
                    {loans.map(loan => (
                      <LoanAccordionItem 
                        key={loan.id}
                        loan={loan} 
                        loanType={loanType}
                        accounts={accounts}
                        onEditTransaction={openEditDialog}
                        onDeleteLoan={handleDeleteLoan}
                        onDeleteTransaction={handleDeleteLoanTransaction}
                        onEditLoanName={openEditLoanNameDialog}
                        startDate={startDate}
                        endDate={endDate}
                        allowedAccountIds={allowedAccountIds}
                      />
                    ))}
                    {otherCards && allTransactions && loanType === 'taken' && otherCards.map(card => (
                       (allowedAccountIds?.includes(card.id)) && (
                         <CardAccordionItem
                              key={card.id}
                              card={card}
                              accounts={accounts}
                              transactions={allTransactions}
                              startDate={startDate}
                              endDate={endDate}
                              onEditTransaction={openEditCardTxDialog}
                              onDeleteTransaction={handleDeleteCardTransaction}
                          />
                       )
                    ))}
                </Accordion>
            )}
        </CardContent>
      </Card>
      
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <form onSubmit={handleEditLoanTransaction}>
                <DialogHeader>
                    <DialogTitle>Edit Loan Transaction</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-date">Date</Label>
                          <Input id="edit-date" name="date" type="date" defaultValue={selectedTransaction ? format(parseISO(selectedTransaction.date), 'yyyy-MM-dd') : ''} required />
                        </div>
                        <div className="space-y-2">
                           <Label htmlFor="edit-amount">Amount</Label>
                           <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={selectedTransaction?.amount} required />
                        </div>
                    </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                              <Label htmlFor="edit-myAccountId">Account</Label>
                              <Select name="myAccountId" required defaultValue={selectedTransaction?.accountId}>
                                  <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                                  <SelectContent>
                                      {allAccountsForTx.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                  </SelectContent>
                              </Select>
                         </div>
                         <div className="space-y-2">
                              <Label htmlFor="edit-description">Description</Label>
                              <Textarea id="edit-description" name="description" placeholder="Optional notes" defaultValue={selectedTransaction?.description} />
                         </div>
                     </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      
        <Dialog open={isEditLoanNameDialogOpen} onOpenChange={setIsEditLoanNameDialogOpen}>
            <DialogContent onInteractOutside={(e) => e.preventDefault()}>
                <form onSubmit={handleEditLoanName}>
                    <DialogHeader>
                        <DialogTitle>Edit Person/Account Name</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-personName">Name</Label>
                            <Input id="edit-personName" name="personName" defaultValue={selectedLoan?.personName} required />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        
        <Dialog open={isEditCardTxDialogOpen} onOpenChange={(open) => {
          if (!open) setSelectedCardTransaction(null);
          setIsEditCardTxDialogOpen(open);
        }}>
          <DialogContent className="sm:max-w-md">
              <form onSubmit={handleEditCardTransaction}>
                  <DialogHeader>
                      <DialogTitle>Edit Card Transaction</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                          <Label htmlFor="edit-card-date">Date</Label>
                          <Input id="edit-card-date" name="date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} required />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="edit-card-description">Description</Label>
                          <Textarea id="edit-card-description" name="description" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </div>
                      {selectedCardTransaction?.type === 'expense' && (
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor="edit-card-category">Category</Label>
                                  <Select name="category" onValueChange={(value) => { setEditCategory(value); setEditSubCategory(undefined); }} value={editCategory}>
                                      <SelectTrigger id="edit-card-category">
                                          <SelectValue placeholder="Select category" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {editCategoriesForDropdown.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                                      </SelectContent>
                                  </Select>
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="edit-card-subcategory">Sub-category</Label>
                                  <Select name="subcategory" value={editSubCategory} onValueChange={setEditSubCategory} disabled={!editCategory || editSubcategories.length === 0}>
                                      <SelectTrigger id="edit-card-subcategory">
                                          <SelectValue placeholder="Select sub-category" />
                                      </SelectTrigger>
                                          <SelectContent>
                                              {editSubcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}
                                          </SelectContent>
                                  </Select>
                              </div>
                          </div>
                      )}
                      <div className="space-y-2">
                          <Label htmlFor="edit-card-amount">Amount</Label>
                          <Input
                              id="edit-card-amount"
                              name="amount"
                              placeholder="e.g. 100/2"
                              required
                              className="hide-number-arrows"
                              value={editAmount}
                              onChange={handleAmountChange(setEditAmount)}
                              onBlur={() => handleAmountBlur(editAmount, setEditAmount)}
                          />
                      </div>
                  </div>
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                      <Button type="submit">Save Changes</Button>
                  </DialogFooter>
              </form>
          </DialogContent>
      </Dialog>
    </>
  );
}
