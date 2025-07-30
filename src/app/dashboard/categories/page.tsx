"use client";

import { CategoryList } from "@/components/dashboard/categories/category-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-muted-foreground">
          Organize your spending, income, and bank accounts by creating custom categories.
        </p>
      </div>
      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense">Expense Categories</TabsTrigger>
          <TabsTrigger value="bank">Bank Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="expense" className="mt-6">
           <CategoryList categoryType="expense" />
        </TabsContent>
        <TabsContent value="bank" className="mt-6">
           <CategoryList categoryType="bank" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
