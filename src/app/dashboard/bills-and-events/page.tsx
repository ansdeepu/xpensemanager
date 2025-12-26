
"use client";

import { BillList } from "@/components/dashboard/bills/bill-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function BillsPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="bills" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="special_days">Special Days</TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="mt-6">
          <BillList eventType="bill" />
        </TabsContent>
        <TabsContent value="special_days" className="mt-6">
          <BillList eventType="special_day" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
