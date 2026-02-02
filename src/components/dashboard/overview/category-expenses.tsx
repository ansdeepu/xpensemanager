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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter as DialogFooterComponent,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Category, Account } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, ShoppingBasket, Car, Home, Heart, BookOpen, Banknote, Briefcase, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

const iconComponents: { [key: string]: React.ComponentType<{ className?: string }> } = {
  Tag,
  ShoppingBasket,
  Car,
  Home,
  Heart,
  BookOpen,
  Banknote,
  Briefcase,
  Gift,
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type CategoryDetail = {
  name: string;
  total: number;
  subcategories: { [key: string]: number };
};

export function CategoryExpenses() {
  const [user, loading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<CategoryDetail | null>(null);

  useEffect(() => {
    if (user && db) {
      const expenseCategoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "expense"), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(expenseCategoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        if(dataLoading) setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid), where("type", "==", "expense"));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      // Fetch accounts
      const accountsQuery = query(collection(db, "accounts"), where("userId", "==", user.uid));
      const unsubscribeAccounts = onSnapshot(accountsQuery, (snapshot) => {
          setAccounts(snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as Account));
      });

      return () => {
        unsubscribeCategories();
        unsubscribeTransactions();
        unsubscribeAccounts(); // Cleanup
      };
    } else if (!user) {
        if(dataLoading) setDataLoading(false);
    }
  }, [user, db, dataLoading]);

  const monthInterval = useMemo(() => ({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);
  const currentMonthName = useMemo(() => months[currentDate.getMonth()], [currentDate]);
  
  const primaryAccount = useMemo(() => accounts.find(a => a.isPrimary), [accounts]);
  const creditCardIds = useMemo(() => accounts.filter(acc => acc.type === 'card').map(acc => acc.id), [accounts]);

  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!isWithinInterval(new Date(t.date), monthInterval)) {
        return false;
      }
      
      if (!primaryAccount) {
          return true; // Show all if no primary account is set yet
      }

      const isPrimaryAccountExpense = t.accountId === primaryAccount.id;
      const isWalletExpense = t.paymentMethod === 'cash' || t.paymentMethod === 'digital';
      const isCreditCardExpense = t.accountId ? creditCardIds.includes(t.accountId) : false;

      return isPrimaryAccountExpense || isWalletExpense || isCreditCardExpense;
    });
  }, [transactions, monthInterval, primaryAccount, creditCardIds]);


  const categoryStats = useMemo(() => {
    const stats: Record<string, { id: string; spent: number; budget: number; name: string, icon: string, subcategories: { [key: string]: number }, subcategoryCount: number }> = {};

    categories.forEach(cat => {
      const categoryBudget = cat.subcategories
        .filter(sub => 
            sub.frequency === 'monthly' || 
            (sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName))
        )
        .reduce((sum, sub) => sum + (sub.amount || 0), 0);

      stats[cat.id] = { 
        id: cat.id, 
        spent: 0, 
        budget: categoryBudget, 
        name: cat.name, 
        icon: cat.icon,
        subcategories: {},
        subcategoryCount: cat.subcategories.length
      };
    });

    monthlyTransactions.forEach(t => {
      const category = categories.find(c => c.id === t.categoryId || c.name === t.category);
      if (category && stats[category.id]) {
        stats[category.id].spent += t.amount;
        const subCategoryName = t.subcategory || "Unspecified";
        stats[category.id].subcategories[subCategoryName] = (stats[category.id].subcategories[subCategoryName] || 0) + t.amount;
      }
    });
    
    return Object.values(stats).filter(s => s.spent > 0 || s.budget > 0);
  }, [categories, monthlyTransactions, currentMonthName]);

  const totalExpenses = useMemo(() => {
    return categoryStats.reduce((sum, stat) => sum + stat.spent, 0);
  }, [categoryStats]);

  const totalBudget = useMemo(() => {
    return categoryStats.reduce((sum, stat) => sum + stat.budget, 0);
  }, [categoryStats]);
  
  const totalProgress = useMemo(() => {
    if (totalBudget === 0) return 0;
    return (totalExpenses / totalBudget) * 100;
  }, [totalExpenses, totalBudget]);

  const goToPreviousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
  };
  
  const handleCategoryClick = (categoryStat: {name: string, spent: number, subcategories: { [key: string]: number }}) => {
    setSelectedCategoryDetail({
      name: categoryStat.name,
      total: categoryStat.spent,
      subcategories: categoryStat.subcategories
    });
    setIsDetailDialogOpen(true);
  };


  if (loading || dataLoading) {
      return (
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-1/4" />
                  <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
              </CardContent>
          </Card>
      )
  }

  return (
    <>
    <Card className="h-full flex flex-col">
    <CardHeader>
        <CardTitle>Category Expenses</CardTitle>
        <div className="flex justify-between items-center">
            <CardDescription>Your spending breakdown for the month from your primary account, wallets, and credit cards.</CardDescription>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-28 text-center">{format(currentDate, "MMMM yyyy")}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </CardHeader>
    <CardContent className="flex-1 min-h-0">
        {categoryStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-full">
                <Tag className="h-10 w-10 mb-2"/>
                <p>No expense categories or transactions found for this month.</p>
            </div>
        ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryStats.map(stat => {
                      const IconComponent = iconComponents[stat.icon] || Tag;
                      const percentage = stat.budget > 0 ? Math.min((stat.spent / stat.budget) * 100, 100) : 0;
                      return (
                        <Card key={stat.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold">{stat.name}</span>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div 
                                  className="text-right cursor-pointer"
                                  onClick={() => handleCategoryClick(stat)}
                                >
                                    <div className="font-bold text-lg">{formatCurrency(stat.spent)}</div>
                                    {stat.budget > 0 && <div className="text-xs text-muted-foreground"> of {formatCurrency(stat.budget)}</div>}
                                </div>
                                {stat.budget > 0 && <Progress value={percentage} className="mt-2" />}
                            </CardContent>
                        </Card>
                      )
                  })}
              </div>
        )}
    </CardContent>
    {categoryStats.length > 0 && (
         <CardFooter className="flex flex-col items-start pt-4 border-t gap-2">
            <div className="w-full space-y-2">
                <div className="flex justify-between w-full font-medium">
                    <span>Total Expenses</span>
                    <span>{formatCurrency(totalExpenses)}</span>
                </div>
                 {totalBudget > 0 && (
                    <>
                      <Progress value={totalProgress} />
                      <div className="flex justify-between w-full text-sm text-muted-foreground">
                          <span>Budget</span>
                          <span>{formatCurrency(totalBudget)}</span>
                      </div>
                    </>
                )}
            </div>
        </CardFooter>
    )}
  </Card>

  <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
    <DialogContent onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
        <DialogTitle>{selectedCategoryDetail?.name} - Sub-category Breakdown</DialogTitle>
        <DialogDescription>
            Details of your spending in this category for {format(currentDate, "MMMM yyyy")}.
        </DialogDescription>
        </DialogHeader>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Sub-category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {selectedCategoryDetail && Object.keys(selectedCategoryDetail.subcategories).length > 0 ? (
                    Object.entries(selectedCategoryDetail.subcategories)
                    .sort(([,a],[,b]) => b - a)
                    .map(([name, amount]) => (
                    <TableRow key={name}>
                        <TableCell>{name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(amount)}</TableCell>
                    </TableRow>
                ))) : (
                    <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">No sub-category spending for this period.</TableCell>
                    </TableRow>
                )}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">{formatCurrency(selectedCategoryDetail?.total || 0)}</TableHead>
                </TableRow>
            </TableFooter>
        </Table>
          <DialogFooterComponent>
            <DialogClose asChild>
                <Button type="button" variant="secondary">Close</Button>
            </DialogClose>
        </DialogFooterComponent>
    </DialogContent>
  </Dialog>
  </>
  )
}
