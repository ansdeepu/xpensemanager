
"use client";

import { CategoryList } from "@/components/dashboard/categories/category-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground">
          Organize your spending and income by creating custom categories.
        </p>
      </div>
      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expense">Expense Categories</TabsTrigger>
          <TabsTrigger value="income">Income Categories</TabsTrigger>
          <TabsTrigger value="bank-expense">Bank Expense Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="expense" className="mt-6">
           <CategoryList categoryType="expense" />
        </TabsContent>
        <TabsContent value="income" className="mt-6">
           <CategoryList categoryType="income" />
        </TabsContent>
         <TabsContent value="bank-expense" className="mt-6">
           <CategoryList categoryType="bank-expense" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
