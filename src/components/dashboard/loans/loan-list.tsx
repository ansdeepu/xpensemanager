
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
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan, LoanTransaction, Account, Transaction } from "@/lib/data";
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

function LoanAccordionItem({ 
    loan, 
    loanType,
    onEditTransaction, 
    onDeleteLoan, 
    onDeleteTransaction,
    onEditLoanName,
}: { 
    loan: Loan;
    loanType: "taken" | "given";
    onEditTransaction: (loan: Loan, transaction: LoanTransaction) => void;
    onDeleteLoan: (loan: Loan) => void;
    onDeleteTransaction: (loan: Loan, transaction: LoanTransaction) => void;
    onEditLoanName: (loan: Loan) => void;
}) {
    const transactionsWithRunningBalance = useMemo(() => {
        const chronologicalTransactions = [...loan.transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
        let runningBalance = 0;
        const transactionsWithDetails = chronologicalTransactions.map(transaction => {
            let credit = 0;
            let debit = 0;
            
            if (loan.type === 'taken') {
                if (transaction.type === 'loan') {
                    credit = transaction.amount;
                    runningBalance += transaction.amount;
                } else { // repayment
                    debit = transaction.amount;
                    runningBalance -= transaction.amount;
                }
            } else { // 'given'
                if (transaction.type === 'loan') {
                    debit = transaction.amount;
                    runningBalance += transaction.amount;
                } else { // repayment
                    credit = transaction.amount;
                    runningBalance -= transaction.amount;
                }
            }
    
            return { ...transaction, credit, debit, balance: runningBalance };
        });
    
        return transactionsWithDetails.reverse();
    }, [loan]);

    const getLoanTransactionDescription = (loan: Loan, transaction: LoanTransaction) => {
        if (transaction.description != null) return transaction.description;

        if (loan.type === 'given') {
            return transaction.type === 'loan' ? `Loan to ${loan.personName}` : `Repayment from ${loan.personName}`;
        } else { // loan.type === 'taken'
            return transaction.type === 'loan' ? `Loan from ${loan.personName}` : `Repayment to ${loan.personName}`;
        }
    };

    return (
        <AccordionItem value={loan.id}>
            <AccordionTrigger>
                <div className="grid grid-cols-3 w-full items-center">
                    <div className="flex items-center gap-4">
                        <span className="font-semibold text-base">{loan.personName}</span>
                    </div>
                    <div className="text-center">
                        <Badge variant={loan.balance > 0 ? 'destructive' : 'default'} className="text-sm">{formatCurrency(loan.balance)}</Badge>
                    </div>
                    <div></div>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="flex justify-center px-4 pb-4">
                    <Card className="bg-muted/50 w-full lg:w-2/3">
                        <CardHeader className="pb-2 flex-row justify-between items-center">
                            <div className="flex items-center gap-2">
                                <CardDescription className="flex gap-4">
                                    <span>Total Loan: <span className="font-semibold text-foreground">{formatCurrency(loan.totalLoan)}</span></span>
                                    <span>Total Repayment: <span className="font-semibold text-foreground">{formatCurrency(loan.totalRepayment)}</span></span>
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
                                        {transactionsWithRunningBalance.map(t => (
                                            <TableRow key={t.id}>
                                                <TableCell className="px-2 py-1">{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                <TableCell className="px-2 py-1">
                                                    <Badge variant={t.type === 'loan' ? 'outline' : 'secondary'} className="capitalize text-xs">{t.type}</Badge>
                                                </TableCell>
                                                <TableCell className="px-2 py-1">{getLoanTransactionDescription(loan, t)}</TableCell>
                                                <TableCell className="text-right font-mono text-green-600 px-2 py-1">
                                                    {t.credit > 0 ? formatCurrency(t.credit) : null}
                                                </TableCell>
                                                <TableCell className="text-right font-mono text-red-600 px-2 py-1">
                                                    {t.debit > 0 ? formatCurrency(t.debit) : null}
                                                </TableCell>
                                                <TableCell className={cn("text-right font-mono px-2 py-1", t.balance > 0 ? 'text-foreground' : '')}>
                                                    {formatCurrency(t.balance)}
                                                </TableCell>
                                                <TableCell className="text-right px-2 py-1">
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


export function LoanList({ loanType }: { loanType: "taken" | "given" }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isEditLoanNameDialogOpen, setIsEditLoanNameDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<LoanTransaction | null>(null);
  const [user, loading] = useAuthState();
  const [clientLoaded, setClientLoaded] = useState(false);
  const { toast } = useToast();


  // States for the add dialog
  const [personName, setPersonName] = useState("");
  const [isNewPerson, setIsNewPerson] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState<'loan' | 'repayment'>('loan');


  useEffect(() => {
    setClientLoaded(true);
  }, []);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "loans"),
        where("userId", "==", user.uid),
        where("type", "==", loanType)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const userLoans = snapshot.docs.map(doc => {
            const data = doc.data();
            const transactions: LoanTransaction[] = (data.transactions || []).sort((a: LoanTransaction, b: LoanTransaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const totalLoan = transactions.filter((t: LoanTransaction) => t.type === 'loan').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
            const totalRepayment = transactions.filter((t: LoanTransaction) => t.type === 'repayment').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
            
            return {
              id: doc.id,
              ...data,
              transactions,
              totalLoan,
              totalRepayment,
              balance: totalLoan - totalRepayment,
            } as Loan;
          });
          setLoans(userLoans.sort((a, b) => b.balance - a.balance));
        });

      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
          setAccounts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Omit<Account, 'balance'>));
      });

      return () => {
        unsubscribe();
        unsubscribeAccounts();
      };
    }
  }, [user, loanType]);

  const resetAddDialog = () => {
    setIsNewPerson(false);
    setPersonName("");
    setSelectedPersonId(null);
    setTransactionType('loan');
  }

 const handleAddLoanTransaction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;
  
    const formData = new FormData(event.currentTarget);
    const amount = parseFloat(formData.get("amount") as string);
    const myAccountId = formData.get("myAccountId") as string;
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
  
    let otherPartyName: string | undefined;
    
    const allLoanParties: (Loan | Omit<Account, "balance">)[] = [
      ...loans,
      ...accounts.filter(a => !a.isPrimary)
    ];

    if (isNewPerson) {
      otherPartyName = personName;
    } else if (selectedPersonId) {
        const existingParty = allLoanParties.find(l => l.id === selectedPersonId);
        if (existingParty) {
            if ('personName' in existingParty) {
                otherPartyName = existingParty.personName;
            } else {
                otherPartyName = existingParty.name;
            }
        }
    }

    if (!otherPartyName) {
      toast({ variant: "destructive", title: "Person or account name is required" });
      return;
    }
    
    // The other party's ID for the transfer transaction
    const otherPartyAccountIdForTransfer = `loan-virtual-account-${otherPartyName.replace(/\s+/g, '-')}` 

    const newLoanTransaction: LoanTransaction = {
      id: new Date().getTime().toString() + Math.random().toString(36).substring(2, 9),
      date,
      amount,
      accountId: myAccountId, // The user's account involved
      description,
      type: transactionType,
    };
  
    try {
      const batch = writeBatch(db);
  
      let loanDocRef;
      // Find an existing loan record by person's name
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

      if (loanType === 'taken') { // You are borrowing money
          fromAccountId = transactionType === 'loan' ? otherPartyAccountIdForTransfer! : myAccountId;
          toAccountId = transactionType === 'loan' ? myAccountId : otherPartyAccountIdForTransfer!;
      } else { // You are lending money
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
        } else { // given
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
             // Transaction is missing, so create it
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

  const handleDeleteLoanTransaction = async (loan: Loan, transactionToDelete: LoanTransaction) => {
    if (!user) return;

    const newTransactions = loan.transactions.filter(t => t.id !== transactionToDelete.id);

    try {
        const batch = writeBatch(db);
        const loanRef = doc(db, "loans", loan.id);

        if (newTransactions.length > 0) {
            batch.update(loanRef, { transactions: newTransactions });
        } else {
            batch.delete(loanRef); // Delete the loan doc if no transactions left
        }

        // Find and delete the corresponding financial transaction
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
  
  const handleDeleteLoan = async (loan: Loan) => {
    if (!user) return;
    try {
        const batch = writeBatch(db);

        // Delete the loan document
        const loanRef = doc(db, "loans", loan.id);
        batch.delete(loanRef);
        
        // Find and delete all associated financial transactions
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

  const otherAccounts = useMemo(() => accounts.filter(a => !a.isPrimary), [accounts]);


  if (loading || !clientLoaded) {
    return <Skeleton className="h-96 w-full" />;
  }
  
  // This is a check to ensure we don't try to render before accounts are loaded.
  if (user && accounts.length === 0 && loans.length > 0) {
      return <Skeleton className="h-96 w-full" />;
  }

  const title = loanType === "taken" ? "Loans Taken" : "Loans Given";
  const description =
    loanType === "taken"
      ? "Consolidated view of money you have borrowed."
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
            setIsAddDialogOpen(open);
            if (!open) resetAddDialog();
          }}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Record
              </Button>
            </DialogTrigger>
            <DialogContent onInteractOutside={(e) => e.preventDefault()} className="sm:max-w-3xl">
              <form onSubmit={handleAddLoanTransaction}>
                <DialogHeader>
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
                              <SelectGroup>
                                <SelectLabel>People</SelectLabel>
                                {loans.map(l => <SelectItem key={l.id} value={l.id}>{l.personName}</SelectItem>)}
                              </SelectGroup>
                              
                                <SelectGroup>
                                    <SelectLabel>Your Other Accounts</SelectLabel>
                                    {otherAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                </SelectGroup>
                              
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
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
            {loans.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <HandCoins className="h-10 w-10 mb-2" />
                    <p>No loans recorded yet. Click "Add Record" to get started.</p>
                </div>
            ) : (
                <Accordion type="single" collapsible className="w-full">
                    {loans.map(loan => (
                      <LoanAccordionItem 
                        key={loan.id}
                        loan={loan} 
                        loanType={loanType}
                        onEditTransaction={openEditDialog}
                        onDeleteLoan={handleDeleteLoan}
                        onDeleteTransaction={handleDeleteLoanTransaction}
                        onEditLoanName={openEditLoanNameDialog}
                      />
                    ))}
                </Accordion>
            )}
        </CardContent>
      </Card>
      
      {/* Edit Transaction Dialog */}
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
      
      {/* Edit Loan Name Dialog */}
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
    </>
  );
}

    