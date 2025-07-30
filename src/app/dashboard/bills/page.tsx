
"use client";

import { BillList } from "@/components/dashboard/bills/bill-list";

export default function BillsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Upcoming Bills</h1>
      <BillList />
    </div>
  );
}
