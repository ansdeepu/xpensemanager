
"use client";

import { useState, useEffect } from "react";
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
import { PlusCircle, Pencil, Trash2, CalendarIcon, FileText, Repeat } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, differenceInDays, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { Bill } from "@/lib/data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
};

export function BillList() {
    const [bills, setBills] = useState<Bill[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [editDate, setEditDate] = useState<Date | undefined>();
    const [user, loading] = useAuthState(auth);

    useEffect(() => {
        if (user && db) {
            const billsQuery = query(collection(db, "bills"), where("userId", "==", user.uid), orderBy("dueDate", "asc"));
            const unsubscribeBills = onSnapshot(billsQuery, (querySnapshot) => {
                const userBills: Bill[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    // Reset paidOn if due date is in the future and bill was paid in the past
                    if (data.paidOn && isPast(new Date(data.dueDate)) && new Date(data.paidOn) < new Date(data.dueDate)) {
                        // This logic might need adjustment based on how you want to handle recurring bills' paid status.
                        // For now, if a new due date is set, we can consider it unpaid for the new cycle.
                    }
                    userBills.push({ id: doc.id, ...data } as Bill);
                });
                setBills(userBills);
            });
            
            return () => unsubscribeBills();
        }
    }, [user, db]);

    useEffect(() => {
        if (selectedBill) {
            setEditDate(new Date(selectedBill.dueDate));
        } else {
            setEditDate(undefined);
        }
    }, [selectedBill]);

    const handleAddBill = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user || !date) return;

        const formData = new FormData(event.currentTarget);
        const newBill = {
            userId: user.uid,
            title: formData.get("title") as string,
            amount: parseFloat(formData.get("amount") as string),
            dueDate: date.toISOString(),
            recurrence: formData.get("recurrence") as Bill['recurrence'],
        };

        try {
            await addDoc(collection(db, "bills"), newBill);
            setIsAddDialogOpen(false);
            setDate(new Date());
        } catch (error) {
        }
    };

    const handleEditBill = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user || !selectedBill || !editDate) return;

        const formData = new FormData(event.currentTarget);
        const updatedData = {
            title: formData.get("title") as string,
            amount: parseFloat(formData.get("amount") as string),
            dueDate: editDate.toISOString(),
            recurrence: formData.get("recurrence") as Bill['recurrence'],
        };

        try {
            const billRef = doc(db, "bills", selectedBill.id);
            await updateDoc(billRef, updatedData);
            setIsEditDialogOpen(false);
            setSelectedBill(null);
        } catch (error) {
        }
    };

    const handleDeleteBill = async (billId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, "bills", billId));
        } catch (error) {
        }
    };

    const openEditDialog = (bill: Bill) => {
        setSelectedBill(bill);
        setIsEditDialogOpen(true);
    };

    const getStatusBadge = (bill: Bill) => {
        const dueDate = new Date(bill.dueDate);
        const paidOnDate = bill.paidOn ? new Date(bill.paidOn) : null;
        
        // If paid, check if the payment corresponds to the current due cycle.
        if (paidOnDate) {
            // A simple check could be if the payment date is after the previous due date.
            // This logic can get complex for recurring bills. For simplicity, we'll assume
            // if paidOn exists, it's for the current or a past cycle.
            return <Badge variant="secondary" className="border-green-500 text-green-700">Paid on {format(paidOnDate, 'dd/MM/yy')}</Badge>;
        }
        
        if (isPast(dueDate)) {
            return <Badge variant="destructive">Overdue</Badge>;
        }
        return <Badge variant="outline">Upcoming</Badge>;
    }


    if (loading) {
        return <Skeleton className="h-96 w-full" />
    }

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Manage Your Bills</CardTitle>
                        <CardDescription>
                            Keep track of your upcoming payments.
                        </CardDescription>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Bill
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <form onSubmit={handleAddBill}>
                                <DialogHeader>
                                    <DialogTitle>Add New Bill</DialogTitle>
                                    <DialogDescription>
                                        Enter the details for your new bill.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Title</Label>
                                        <Input id="title" name="title" placeholder="e.g. Credit Card" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="amount">Amount</Label>
                                            <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required className="hide-number-arrows" />
                                        </div>
                                         <div className="space-y-2">
                                            <Label htmlFor="recurrence">Recurrence</Label>
                                            <Select name="recurrence" defaultValue="none">
                                                <SelectTrigger id="recurrence">
                                                    <SelectValue placeholder="Select recurrence" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                                    <SelectItem value="yearly">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="date">Due Date</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant={"outline"}
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit">Add Bill</Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bills.map((bill) => {
                                const daysUntilDue = differenceInDays(new Date(bill.dueDate), new Date());
                                const isOverdue = daysUntilDue < 0 && !bill.paidOn;
                                return (
                                <TableRow key={bill.id} className={cn(bill.paidOn && "text-muted-foreground")}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <span>{bill.title}</span>
                                             {bill.recurrence !== 'none' && (
                                                <Badge variant="outline" className="capitalize flex items-center gap-1">
                                                   <Repeat className="h-3 w-3" />
                                                   {bill.recurrence}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div>{format(new Date(bill.dueDate), 'dd/MM/yyyy')}</div>
                                        <div className={cn("text-xs", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                                            {bill.paidOn ? " " : isOverdue ? `Overdue by ${-daysUntilDue} days` : `Due in ${daysUntilDue} days`}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(bill.amount)}</TableCell>
                                    <TableCell>{getStatusBadge(bill)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(bill)} className="mr-2">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the bill. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteBill(bill.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            )})}
                        </TableBody>
                    </Table>
                     {bills.length === 0 && (
                        <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                            <FileText className="h-10 w-10 mb-2"/>
                            <p>No upcoming bills. Click "Add Bill" to get started.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Bill Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <form onSubmit={handleEditBill}>
                        <DialogHeader>
                            <DialogTitle>Edit Bill</DialogTitle>
                            <DialogDescription>
                                Update the details for your bill.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Title</Label>
                                <Input id="edit-title" name="title" defaultValue={selectedBill?.title} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-amount">Amount</Label>
                                    <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={selectedBill?.amount} required className="hide-number-arrows" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-recurrence">Recurrence</Label>
                                    <Select name="recurrence" defaultValue={selectedBill?.recurrence || 'none'}>
                                        <SelectTrigger id="edit-recurrence">
                                            <SelectValue placeholder="Select recurrence" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="edit-date">Due Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {editDate ? format(editDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={editDate} onSelect={setEditDate} initialFocus />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" onClick={() => setSelectedBill(null)}>Cancel</Button></DialogClose>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
