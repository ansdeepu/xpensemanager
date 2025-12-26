
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
import { PlusCircle, Pencil, Trash2, CalendarIcon as Calendar, FileText, Repeat, Gift } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, doc, deleteDoc, updateDoc, orderBy } from "firebase/firestore";
import { format, differenceInDays, isPast, addMonths, addQuarters, addYears, setDate as setDayOfMonth, getDate, parseISO, isBefore } from "date-fns";
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

const getDayWithOrdinal = (d: number) => {
  if (d > 3 && d < 21) return `${d}th`;
  switch (d % 10) {
    case 1:  return `${d}st`;
    case 2:  return `${d}nd`;
    case 3:  return `${d}rd`;
    default: return `${d}th`;
  }
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthSelector({ selectedMonths, onMonthToggle }: { selectedMonths: string[], onMonthToggle: (month: string) => void }) {
    return (
        <div className="space-y-2">
            <Label>Select Months</Label>
            <div className="grid grid-cols-4 gap-2">
                {months.map(month => (
                    <Button
                        key={month}
                        type="button"
                        variant={selectedMonths.includes(month) ? "default" : "outline"}
                        onClick={() => onMonthToggle(month)}
                        className="h-8 text-xs"
                    >
                        {month}
                    </Button>
                ))}
            </div>
        </div>
    );
}


const formatDueDate = (bill: Bill) => {
    const dueDate = parseISO(bill.dueDate);
    
    if (bill.type === 'special_day') {
        return format(dueDate, 'dd/MM/yyyy');
    }

    const day = getDayWithOrdinal(getDate(dueDate));

    switch (bill.recurrence) {
        case 'monthly':
            return `${day} of every month`;
        case 'quarterly': {
            if (bill.selectedMonths && bill.selectedMonths.length > 0) {
                return `${day} of ${bill.selectedMonths.join(', ')}`;
            }
            const firstMonth = format(dueDate, 'MMM');
            const secondMonth = format(addMonths(dueDate, 3), 'MMM');
            const thirdMonth = format(addMonths(dueDate, 6), 'MMM');
            const fourthMonth = format(addMonths(dueDate, 9), 'MMM');
            return `${day} of ${firstMonth}, ${secondMonth}, ${thirdMonth}, ${fourthMonth}`;
        }
        case 'yearly':
             if (bill.selectedMonths && bill.selectedMonths.length > 0) {
                return `${day} of ${bill.selectedMonths.join(', ')}`;
            }
            return `${day} of ${format(dueDate, 'MMM')}`;
        case 'occasional': {
            if (bill.selectedMonths && bill.selectedMonths.length > 0) {
                return `${day} of ${bill.selectedMonths.join(', ')}`;
            }
            return `${day} of ${format(dueDate, 'MMM')} (Occasional)`;
        }
        default:
            return format(dueDate, 'dd/MM/yyyy');
    }
};


export function BillList({ eventType }: { eventType: 'bill' | 'special_day' }) {
    const [allEvents, setAllEvents] = useState<Bill[]>([]);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
    const [user, loading] = useAuthState(auth);
    const [clientLoaded, setClientLoaded] = useState(false);
    
    // Add dialog state - default to the current tab's event type
    const [addEventType, setAddEventType] = useState<Bill['type']>(eventType);
    const [addDay, setAddDay] = useState<number>(getDate(new Date()));
    const [addDate, setAddDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [addRecurrence, setAddRecurrence] = useState<Bill['recurrence']>('occasional');
    const [addSelectedMonths, setAddSelectedMonths] = useState<string[]>([]);

    // Edit dialog state
    const [editDay, setEditDay] = useState<number | undefined>();
    const [editDate, setEditDate] = useState<string>('');
    const [editEventType, setEditEventType] = useState<Bill['type']>('bill');
    const [editRecurrence, setEditRecurrence] = useState<Bill['recurrence']>('occasional');
    const [editSelectedMonths, setEditSelectedMonths] = useState<string[]>([]);

    // When the component mounts or the eventType prop changes, update the default for the add dialog
    useEffect(() => {
        setAddEventType(eventType);
    }, [eventType]);


    useEffect(() => {
        setClientLoaded(true);
    }, []);

    useEffect(() => {
        if (user && db) {
            const billsQuery = query(collection(db, "bills"), where("userId", "==", user.uid), orderBy("dueDate", "asc"));
            const unsubscribeBills = onSnapshot(billsQuery, (querySnapshot) => {
                const userBills: Bill[] = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    userBills.push({ id: doc.id, ...data } as Bill);
                });
                setAllEvents(userBills);
            });
            
            return () => unsubscribeBills();
        }
    }, [user, db]);

    const bills = useMemo(() => {
        return allEvents.filter(event => event.type === eventType);
    }, [allEvents, eventType]);


    useEffect(() => {
        if (selectedBill) {
            setEditEventType(selectedBill.type || 'bill');
            setEditRecurrence(selectedBill.recurrence || 'occasional');
            setEditSelectedMonths(selectedBill.selectedMonths || []);
            const dueDate = parseISO(selectedBill.dueDate);
            setEditDay(getDate(dueDate));
            setEditDate(format(dueDate, 'yyyy-MM-dd'));
        } else {
            // Reset state when there's no selected bill
            setEditDay(undefined);
            setEditDate('');
            setEditEventType(eventType); // default to current tab
            setEditRecurrence('occasional');
            setEditSelectedMonths([]);
        }
    }, [selectedBill, eventType]);

    const handleMonthToggle = (month: string, setMonths: React.Dispatch<React.SetStateAction<string[]>>) => {
        setMonths(prev => 
            prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
        );
    };

    const handleAddBill = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user) return;

        const formData = new FormData(event.currentTarget);
        const title = formData.get("title") as string;
        
        let determinedDueDate: Date;
        if (addEventType === 'special_day') {
             determinedDueDate = parseISO(formData.get("add-date") as string);
        } else {
            determinedDueDate = setDayOfMonth(new Date(), addDay);
        }

        const newBill: Partial<Bill> & { userId: string } = {
            userId: user.uid,
            title: title,
            dueDate: determinedDueDate.toISOString(),
            recurrence: addRecurrence,
            type: addEventType,
            selectedMonths: addSelectedMonths,
        };
        
        if (addEventType === 'bill') {
            newBill.amount = parseFloat(formData.get("amount") as string);
        }

        try {
            await addDoc(collection(db, "bills"), newBill);
            setIsAddDialogOpen(false);
            // Reset form states
            setAddDay(getDate(new Date()));
            setAddDate(format(new Date(), 'yyyy-MM-dd'));
            setAddEventType(eventType);
            setAddRecurrence('occasional');
            setAddSelectedMonths([]);
        } catch (error) {
        }
    };

    const handleEditBill = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user || !selectedBill) return;

        const formData = new FormData(event.currentTarget);
        const title = formData.get("title") as string;
        
        let determinedDueDate: Date;
        if (editEventType === 'special_day') {
             determinedDueDate = parseISO(formData.get("edit-date") as string);
        } else {
            determinedDueDate = setDayOfMonth(new Date(selectedBill.dueDate), editDay || 1);
        }

        const updatedData: Partial<Bill> = {
            title: title,
            dueDate: determinedDueDate.toISOString(),
            recurrence: editRecurrence,
            type: editEventType,
            selectedMonths: editSelectedMonths,
        };

        if (editEventType === 'bill') {
            updatedData.amount = parseFloat(formData.get("amount") as string);
        } else {
            updatedData.amount = 0; 
        }

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

    const getNextPaymentDate = (bill: Bill) => {
        if (bill.recurrence === 'occasional' || bill.type === 'special_day') return null;

        let dueDate = parseISO(bill.dueDate);
        const now = new Date();

        while (isBefore(dueDate, now) || (bill.paidOn && !isBefore(parseISO(bill.paidOn), dueDate))) {
             switch (bill.recurrence) {
                case 'monthly':
                    dueDate = addMonths(dueDate, 1);
                    break;
                case 'quarterly':
                    dueDate = addQuarters(dueDate, 1);
                    break;
                case 'yearly':
                    dueDate = addYears(dueDate, 1);
                    break;
                default:
                    return null; 
            }
        }
        return dueDate;
    };


    if (loading || !clientLoaded) {
        return <Skeleton className="h-96 w-full" />
    }

    const title = eventType === 'bill' ? 'Bills' : 'Special Days';
    const description = eventType === 'bill' ? 'Keep track of your upcoming payments.' : 'Keep track of your special days.';

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Manage Your {title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
                        setIsAddDialogOpen(open);
                        if (!open) {
                            // Reset state on close
                            setAddEventType(eventType);
                            setAddRecurrence('occasional');
                            setAddSelectedMonths([]);
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Event
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <form onSubmit={handleAddBill}>
                                <DialogHeader>
                                    <DialogTitle>Add New Event</DialogTitle>
                                    <DialogDescription>
                                        Enter the details for your new bill or special day.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="type">Event Type</Label>
                                        <Select name="type" value={addEventType} onValueChange={(value) => setAddEventType(value as Bill['type'])}>
                                            <SelectTrigger id="type">
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="bill">Bill</SelectItem>
                                                <SelectItem value="special_day">Special Day</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Title</Label>
                                        <Input id="title" name="title" placeholder={addEventType === 'bill' ? "e.g. Credit Card" : "e.g. Birthday"} required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {addEventType === 'bill' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="amount">Amount</Label>
                                                <Input id="amount" name="amount" type="number" step="0.01" placeholder="0.00" required className="hide-number-arrows" />
                                            </div>
                                        )}
                                         <div className="space-y-2">
                                            <Label htmlFor="recurrence">Recurrence</Label>
                                            <Select name="recurrence" value={addRecurrence} onValueChange={(value) => setAddRecurrence(value as Bill['recurrence'])}>
                                                <SelectTrigger id="recurrence">
                                                    <SelectValue placeholder="Select recurrence" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="occasional">Occasional</SelectItem>
                                                    <SelectItem value="yearly">Yearly</SelectItem>
                                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    
                                    <MonthSelector selectedMonths={addSelectedMonths} onMonthToggle={(month) => handleMonthToggle(month, setAddSelectedMonths)} />
                                    
                                    {addEventType === 'special_day' ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="add-date">Date</Label>
                                            <Input
                                                id="add-date"
                                                name="add-date"
                                                type="date"
                                                value={addDate}
                                                onChange={(e) => setAddDate(e.target.value)}
                                                className="w-full"
                                                required
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label htmlFor="day">Due Day of Month</Label>
                                            <Input 
                                                id="day" 
                                                name="day" 
                                                type="number" 
                                                min="1" 
                                                max="31"
                                                value={addDay} 
                                                onChange={(e) => setAddDay(parseInt(e.target.value, 10))} 
                                                placeholder="e.g. 26" 
                                                required 
                                            />
                                        </div>
                                    )}
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit">Add Event</Button>
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
                                <TableHead>Title</TableHead>
                                {eventType === 'bill' && <TableHead className="text-right">Amount</TableHead>}
                                <TableHead>Due Date</TableHead>
                                {eventType === 'bill' && <TableHead>Payment Date</TableHead>}
                                {eventType === 'bill' && <TableHead>Next Payment date</TableHead>}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {bills.map((bill, index) => {
                                const dueDate = parseISO(bill.dueDate);
                                const daysUntilDue = differenceInDays(dueDate, new Date());
                                const isOverdue = bill.type === 'bill' && daysUntilDue < 0 && !bill.paidOn;
                                const nextPaymentDate = getNextPaymentDate(bill);
                                return (
                                <TableRow key={bill.id} className={cn(bill.type === 'bill' && bill.paidOn && "text-muted-foreground")}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {bill.type === 'special_day' ? <Gift className="h-4 w-4 text-amber-500" /> : <FileText className="h-4 w-4" />}
                                            <span>{bill.title}</span>
                                             {bill.recurrence !== 'occasional' && (
                                                <Badge variant="outline" className="capitalize flex items-center gap-1">
                                                   <Repeat className="h-3 w-3" />
                                                   {bill.recurrence}
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    {eventType === 'bill' && <TableCell className="text-right font-mono">{bill.type === 'bill' ? formatCurrency(bill.amount) : '-'}</TableCell>}
                                    <TableCell>
                                        <div>{formatDueDate(bill)}</div>
                                        {bill.type === 'bill' && (
                                            <div className={cn("text-xs", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                                                {bill.paidOn ? " " : isOverdue ? `Overdue by ${-daysUntilDue} days` : `Due in ${daysUntilDue} days`}
                                            </div>
                                        )}
                                    </TableCell>
                                    {eventType === 'bill' && <TableCell>
                                        {bill.paidOn ? format(parseISO(bill.paidOn), 'dd/MM/yyyy') : '-'}
                                    </TableCell>}
                                    {eventType === 'bill' && <TableCell>
                                        {nextPaymentDate ? format(nextPaymentDate, 'dd/MM/yyyy') : '-'}
                                    </TableCell>}
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
                                                        This will permanently delete this event. This action cannot be undone.
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
                            <p>No upcoming {eventType === 'bill' ? 'bills' : 'special days'}. Click "Add Event" to get started.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Bill Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleEditBill}>
                        <DialogHeader>
                            <DialogTitle>Edit Event</DialogTitle>
                            <DialogDescription>
                                Update the details for your event.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                             <div className="space-y-2">
                                <Label htmlFor="edit-type">Event Type</Label>
                                <Select name="type" value={editEventType} onValueChange={(value) => setEditEventType(value as Bill['type'])}>
                                    <SelectTrigger id="edit-type">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bill">Bill</SelectItem>
                                        <SelectItem value="special_day">Special Day</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-title">Title</Label>
                                <Input id="edit-title" name="title" defaultValue={selectedBill?.title} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {editEventType === 'bill' && (
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-amount">Amount</Label>
                                        <Input id="edit-amount" name="amount" type="number" step="0.01" defaultValue={selectedBill?.amount} required className="hide-number-arrows" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label htmlFor="edit-recurrence">Recurrence</Label>
                                    <Select name="recurrence" value={editRecurrence} onValueChange={(value) => setEditRecurrence(value as Bill['recurrence'])}>
                                        <SelectTrigger id="edit-recurrence">
                                            <SelectValue placeholder="Select recurrence" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="occasional">Occasional</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             
                            <MonthSelector selectedMonths={editSelectedMonths} onMonthToggle={(month) => handleMonthToggle(month, setEditSelectedMonths)} />
                            
                             {editEventType === 'special_day' ? (
                                <div className="space-y-2">
                                     <Label htmlFor="edit-date">Date</Label>
                                     <Input
                                        id="edit-date"
                                        name="edit-date"
                                        type="date"
                                        value={editDate}
                                        onChange={(e) => setEditDate(e.target.value)}
                                        className="w-full"
                                        required
                                    />
                                </div>
                             ) : (
                                <div className="space-y-2">
                                    <Label htmlFor="edit-day">Due Day of Month</Label>
                                    <Input 
                                        id="edit-day" 
                                        name="edit-day" 
                                        type="number" 
                                        min="1" 
                                        max="31"
                                        value={editDay ?? ''} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setEditDay(val === '' ? undefined : parseInt(val, 10));
                                        }} 
                                        placeholder="e.g. 26" 
                                        required 
                                    />
                                </div>
                             )}
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
