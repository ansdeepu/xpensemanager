
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle, Pencil, Trash2, HandCoins } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  orderBy,
} from "firebase/firestore";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Loan } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [user, loading] = useAuthState();
  const [clientLoaded, setClientLoaded] = useState(false);

  useEffect(() => {
    setClientLoaded(true);
  }, []);

  useEffect(() => {
    if (user && db) {
      const q = query(
        collection(db, "loans"),
        where("userId", "==", user.uid),
        where("type", "==", loanType),
        orderBy("loanDate", "desc")
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const userLoans = snapshot.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as Loan)
          );
          setAllLoans(userLoans);
        },
        (error) => {
          console.error("Error fetching loans:", error);
        }
      );
      return () => unsubscribe();
    }
  }, [user, loanType]);

  const handleAddLoan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) return;

    const formData = new FormData(event.currentTarget);
    const loanDateValue = formData.get("loanDate") as string;
    const dueDateValue = formData.get("dueDate") as string;

    const newLoan = {
      userId: user.uid,
      type: loanType,
      personName: formData.get("personName") as string,
      amount: parseFloat(formData.get("amount") as string),
      loanDate: loanDateValue,
      dueDate: dueDateValue,
      status: formData.get("status") as "open" | "closed",
      description: formData.get("description") as string,
    };

    try {
      await addDoc(collection(db, "loans"), newLoan);
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding loan:", error);
    }
  };

  const handleEditLoan = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedLoan) return;

    const formData = new FormData(event.currentTarget);
    const loanDateValue = formData.get("loanDate") as string;
    const dueDateValue = formData.get("dueDate") as string;

    const updatedData = {
      personName: formData.get("personName") as string,
      amount: parseFloat(formData.get("amount") as string),
      loanDate: loanDateValue,
      dueDate: dueDateValue,
      status: formData.get("status") as "open" | "closed",
      description: formData.get("description") as string,
    };

    try {
      const loanRef = doc(db, "loans", selectedLoan.id);
      await updateDoc(loanRef, updatedData);
      setIsEditDialogOpen(false);
      setSelectedLoan(null);
    } catch (error) {
      console.error("Error updating loan:", error);
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

  const openEditDialog = (loan: Loan) => {
    setSelectedLoan(loan);
    setIsEditDialogOpen(true);
  };

  if (loading || !clientLoaded) {
    return <Skeleton className="h-96 w-full" />;
  }

  const title = loanType === "taken" ? "Loans Taken" : "Loans Given";
  const description =
    loanType === "taken"
      ? "Keep track of money you have borrowed."
      : "Keep track of money you have lent.";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Loan
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <form onSubmit={handleAddLoan}>
                <DialogHeader>
                  <DialogTitle>Add New Loan</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="personName">Person's Name</Label>
                    <Input id="personName" name="personName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="loanDate">Loan Date</Label>
                        <Input id="loanDate" name="loanDate" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="dueDate">Due Date</Label>
                        <Input id="dueDate" name="dueDate" type="date" />
                    </div>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select name="status" defaultValue="open">
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                   <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Optional notes about the loan" />
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit">Add Loan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sl. No.</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Loan Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLoans.map((loan, index) => (
                <TableRow key={loan.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{loan.personName}</TableCell>
                  <TableCell>{loan.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(loan.amount)}
                  </TableCell>
                  <TableCell>
                    {isValid(parseISO(loan.loanDate)) ? format(parseISO(loan.loanDate), "dd/MM/yyyy") : 'Invalid Date'}
                  </TableCell>
                   <TableCell>
                    {loan.dueDate && isValid(parseISO(loan.dueDate)) ? format(parseISO(loan.dueDate), "dd/MM/yyyy") : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={loan.status === 'open' ? 'destructive' : 'default'} className="capitalize">
                      {loan.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(loan)}
                      className="mr-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this loan record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteLoan(loan.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {allLoans.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
              <HandCoins className="h-10 w-10 mb-2" />
              <p>
                No loans recorded yet. Click "Add Loan" to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Loan Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditLoan}>
            <DialogHeader>
              <DialogTitle>Edit Loan</DialogTitle>
            </DialogHeader>
             <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="edit-personName">Person's Name</Label>
                    <Input id="edit-personName" name="personName" defaultValue={selectedLoan?.personName} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-amount">Amount</Label>
                    <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={selectedLoan?.amount} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-loanDate">Loan Date</Label>
                        <Input id="edit-loanDate" name="loanDate" type="date" defaultValue={selectedLoan?.loanDate} required />
                    </div>
                        <div className="space-y-2">
                        <Label htmlFor="edit-dueDate">Due Date</Label>
                        <Input id="edit-dueDate" name="dueDate" type="date" defaultValue={selectedLoan?.dueDate} />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-status">Status</Label>
                    <Select name="status" defaultValue={selectedLoan?.status}>
                        <SelectTrigger id="edit-status">
                        <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea id="edit-description" name="description" defaultValue={selectedLoan?.description} placeholder="Optional notes about the loan" />
                </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" onClick={() => setSelectedLoan(null)}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
