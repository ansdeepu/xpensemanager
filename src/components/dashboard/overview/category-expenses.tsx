
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
import { Progress } from "@/components/ui/progress";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Category, SubCategory } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, ShoppingBasket, Car, Home, Heart, BookOpen, Banknote, Briefcase, Gift, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { addMonths, subMonths, format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useAuthState } from "@/hooks/use-auth-state";

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

export function CategoryExpenses() {
  const [user, loading] = useAuthState();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (user && db) {
      const expenseCategoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "expense"), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(expenseCategoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setDataLoading(false);
      });

      const transactionsQuery = query(collection(db, "transactions"), where("userId", "==", user.uid), where("type", "==", "expense"));
      const unsubscribeTransactions = onSnapshot(transactionsQuery, (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      });

      return () => {
        unsubscribeCategories();
        unsubscribeTransactions();
      };
    } else if (!user) {
        setDataLoading(false);
    }
  }, [user, db]);

  const monthInterval = useMemo(() => ({ start: startOfMonth(currentDate), end: endOfMonth(currentDate) }), [currentDate]);
  const currentMonthName = useMemo(() => months[currentDate.getMonth()], [currentDate]);
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => isWithinInterval(new Date(t.date), monthInterval));
  }, [transactions, monthInterval]);


  const categoryStats = useMemo(() => {
    const stats: Record<string, { id: string; spent: number; budget: number; name: string, icon: string, subcategories: SubCategory[] }> = {};

    categories.forEach(cat => {
      const categoryBudget = cat.subcategories
        .filter(sub => 
            sub.frequency === 'monthly' || 
            (sub.frequency === 'occasional' && sub.selectedMonths?.includes(currentMonthName))
        )
        .reduce((sum, sub) => sum + (sub.amount || 0), 0);

      stats[cat.id] = { id: cat.id, spent: 0, budget: categoryBudget, name: cat.name, icon: cat.icon, subcategories: cat.subcategories };
    });

    monthlyTransactions.forEach(t => {
      const category = categories.find(c => c.id === t.categoryId || c.name === t.category);
      if (category && stats[category.id]) {
        stats[category.id].spent += t.amount;
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
    <Card className="h-full flex flex-col">
    <CardHeader>
        <CardTitle>Category Expenses</CardTitle>
        <div className="flex justify-between items-center">
            <CardDescription>Your spending breakdown for the month.</CardDescription>
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
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categoryStats.map(stat => {
                      const IconComponent = iconComponents[stat.icon] || Tag;
                      const percentage = stat.budget > 0 ? Math.min((stat.spent / stat.budget) * 100, 100) : 0;
                      return (
                          <div key={stat.id} className="space-y-2">
                              <div className="flex justify-between items-center">
                                  <div className="flex items-center gap-2">
                                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                                      <span className="font-medium">{stat.name}</span>
                                  </div>
                                  <div className="text-right">
                                      <div className="font-medium">{formatCurrency(stat.spent)}</div>
                                      {stat.budget > 0 && <div className="text-xs text-muted-foreground"> of {formatCurrency(stat.budget)}</div>}
                                  </div>
                              </div>
                              {stat.budget > 0 && <Progress value={percentage} />}
                          </div>
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
  )
}
