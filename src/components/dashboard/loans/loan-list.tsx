
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
import { PlusCircle, HandCoins, Info, Trash2 } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs, deleteDoc } from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan, LoanTransaction, Account } from "@/lib/data";
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

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

export function LoanList({ loanType }: { loanType: "taken" | "given" }) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Omit<Account, 'balance'>[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [user, loading] = useAuthState();
  const [clientLoaded, setClientLoaded] = useState(false);

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
            const transactions = (data.transactions || []).sort((a: LoanTransaction, b: LoanTransaction) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const totalLoan = transactions.filter(t => t.type === 'loan').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
            const totalRepayment = transactions.filter(t => t.type === 'repayment').reduce((sum: number, t: LoanTransaction) => sum + t.amount, 0);
            
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
    const accountId = formData.get("accountId") as string;
    const date = formData.get("date") as string;
    const description = formData.get("description") as string;
  
    let finalPersonName = isNewPerson ? personName : loans.find(l => l.id === selectedPersonId)?.personName;

    // Check if an account was selected instead of a person
    if (!isNewPerson && selectedPersonId?.startsWith('account-')) {
      const selectedAccountId = selectedPersonId.replace('account-', '');
      finalPersonName = accounts.find(a => a.id === selectedAccountId)?.name;
    }
  
    if (!finalPersonName) {
      console.error("Person or account not selected or name not entered");
      return;
    }
  
    const newTransaction: Omit<LoanTransaction, 'id'> = {
      date,
      amount,
      accountId,
      description,
      type: transactionType,
      id: new Date().getTime().toString() // simple unique id
    };
  
    try {
      const batch = writeBatch(db);
  
      // Find or create the main loan document
      let loanDocRef;
      let existingTransactions: LoanTransaction[] = [];
  
      // If an account was selected or it's a new person, find or create
      const existingLoan = loans.find(l => l.personName === finalPersonName);
      
      if (existingLoan) {
        loanDocRef = doc(db, "loans", existingLoan.id);
        existingTransactions = existingLoan.transactions || [];
        batch.update(loanDocRef, { transactions: [...existingTransactions, newTransaction] });
      } else {
        loanDocRef = doc(collection(db, "loans"));
        const newLoanData = {
          userId: user.uid,
          personName: finalPersonName,
          type: loanType,
          transactions: [newTransaction]
        };
        batch.set(loanDocRef, newLoanData);
      }
  
      // Create the corresponding financial transaction
      const account = accounts.find(a => a.id === accountId);
      const isWallet = accountId === 'cash-wallet' || accountId === 'digital-wallet';
      
      const financialTransaction = {
          userId: user.uid,
          date,
          description: description || `${transactionType === 'loan' ? 'Loan' : 'Repayment'} ${loanType === 'given' ? 'to' : 'from'} ${finalPersonName}`,
          amount,
          type: 'transfer', // All loan activities are treated as transfers
          fromAccountId: loanType === 'given' && transactionType === 'loan' 
            ? accountId // Money leaving bank
            : (loanType === 'taken' && transactionType === 'repayment' ? accountId : `loan-virtual-account`), // Money leaving bank
          toAccountId: loanType === 'taken' && transactionType === 'loan'
            ? accountId // Money entering bank
            : (loanType === 'given' && transactionType === 'repayment' ? accountId : 'loan-virtual-account'), // Money entering bank
          category: 'Loan',
          paymentMethod: isWallet ? accountId.split('-')[0] : 'online'
      };
      
      const transactionRef = doc(collection(db, "transactions"));
      batch.set(transactionRef, financialTransaction as any);
  
      await batch.commit();
      setIsAddDialogOpen(false);
      resetAddDialog();
    } catch (error) {
      console.error("Error adding loan transaction:", error);
    }
  };
  
  const handleDeleteLoan = async (loanId: string) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, "loans", loanId));
    } catch (error) {
        console.error("Error deleting loan:", error);
    }
  };

  const secondaryAccounts = useMemo(() => accounts.filter(a => !a.isPrimary), [accounts]);


  if (loading || !clientLoaded) {
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
            <DialogContent className="sm:max-w-lg">
              <form onSubmit={handleAddLoanTransaction}>
                <DialogHeader>
                  <DialogTitle>Add Loan / Repayment</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                   <div className="space-y-2 col-span-2">
                    <Label>Select Person / Account</Label>
                     <Select onValueChange={value => {
                        if (value === 'new') {
                            setIsNewPerson(true);
                            setSelectedPersonId(null);
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
                            <SelectLabel>Bank Accounts</SelectLabel>
                            {secondaryAccounts.map(acc => <SelectItem key={acc.id} value={`account-${acc.id}`}>{acc.name}</SelectItem>)}
                          </SelectGroup>
                          <SelectGroup>
                             <SelectItem value="new">Add a new person</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                     </Select>
                  </div>

                  {isNewPerson && (
                    <div className="space-y-2 col-span-2">
                        <Label htmlFor="personName">New Person's Name</Label>
                        <Input id="personName" name="personName" value={personName} onChange={e => setPersonName(e.target.value)} required />
                    </div>
                  )}

                  <div className="space-y-2 col-span-2">
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

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="accountId">Account</Label>
                    <Select name="accountId" required>
                        <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                        <SelectContent>
                            {allAccountsForTx.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                  </div>

                   <div className="space-y-2 col-span-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Optional notes" />
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
                        <AccordionItem value={loan.id} key={loan.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between items-center w-full pr-4">
                                    <span className="font-semibold text-lg">{loan.personName}</span>
                                    <Badge variant={loan.balance > 0 ? 'destructive' : 'default'} className="text-base">{formatCurrency(loan.balance)}</Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <Card className="bg-muted/50">
                                    <CardHeader className="pb-2 flex-row justify-between items-center">
                                        <CardDescription className="flex gap-4">
                                            <span>Total Loan: <span className="font-semibold text-foreground">{formatCurrency(loan.totalLoan)}</span></span>
                                            <span>Total Repayment: <span className="font-semibold text-foreground">{formatCurrency(loan.totalRepayment)}</span></span>
                                        </CardDescription>
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
                                                    <AlertDialogAction onClick={() => handleDeleteLoan(loan.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Type</TableHead>
                                                    <TableHead>Account</TableHead>
                                                    <TableHead className="text-right">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {loan.transactions.map(t => (
                                                    <TableRow key={t.id}>
                                                        <TableCell>{isValid(parseISO(t.date)) ? format(parseISO(t.date), "dd/MM/yyyy") : '-'}</TableCell>
                                                        <TableCell>
                                                          <Badge variant={t.type === 'loan' ? 'outline' : 'secondary'} className="capitalize">{t.type}</Badge>
                                                        </TableCell>
                                                        <TableCell>{allAccountsForTx.find(a => a.id === t.accountId)?.name}</TableCell>
                                                        <TableCell className={cn("text-right font-mono", t.type === 'loan' ? 'text-red-500' : 'text-green-600')}>
                                                            {formatCurrency(t.amount)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
        </CardContent>
      </Card>
    </>
  );
}

    