
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
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import type { Transaction, Category } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import { Tag, ShoppingBasket, Car, Home, Heart, BookOpen, Banknote, Briefcase, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount);
};

// Map icon names to components
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

export function CategoryExpenses() {
  const [user] = useAuthState(auth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && db) {
      const expenseCategoriesQuery = query(collection(db, "categories"), where("userId", "==", user.uid), where("type", "==", "expense"), orderBy("order", "asc"));
      const unsubscribeCategories = onSnapshot(expenseCategoriesQuery, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
        setLoading(false);
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
        setLoading(false);
    }
  }, [user, db]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, { spent: number; budget: number; name: string, icon: string }> = {};

    categories.forEach(cat => {
      const categoryBudget = cat.subcategories.reduce((sum, sub) => sum + (sub.budget || 0), 0);
      stats[cat.id] = { spent: 0, budget: categoryBudget, name: cat.name, icon: cat.icon };
    });

    transactions.forEach(t => {
      const category = categories.find(c => c.name === t.category);
      if (category && stats[category.id]) {
        stats[category.id].spent += t.amount;
      }
    });

    return Object.values(stats);
  }, [categories, transactions]);
  
  const totalExpenses = useMemo(() => {
    return categoryStats.reduce((sum, stat) => sum + stat.spent, 0);
  }, [categoryStats]);

  const totalBudget = useMemo(() => {
    return categoryStats.reduce((sum, stat) => sum + stat.budget, 0);
  }, [categoryStats]);


  if (loading) {
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
    <Card>
        <CardHeader>
            <CardTitle>Category Expenses</CardTitle>
            <CardDescription>A breakdown of your spending by category.</CardDescription>
        </CardHeader>
        <CardContent>
            {categoryStats.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-center text-muted-foreground h-40">
                    <Tag className="h-10 w-10 mb-2"/>
                    <p>No expense categories or transactions found.</p>
                </div>
            ) : (
                <ScrollArea className="h-72 pr-4">
                  <div className="space-y-6">
                      {categoryStats.map(stat => {
                          const IconComponent = iconComponents[stat.icon] || Tag;
                          const percentage = stat.budget > 0 ? (stat.spent / stat.budget) * 100 : 0;
                          return (
                              <div key={stat.name} className="space-y-2">
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
                </ScrollArea>
            )}
        </CardContent>
        {categoryStats.length > 0 && (
             <CardFooter className="flex justify-between font-bold pt-6">
                <div>Total Expenses</div>
                <div>{formatCurrency(totalExpenses)}</div>
            </CardFooter>
        )}
    </Card>
  );
}
