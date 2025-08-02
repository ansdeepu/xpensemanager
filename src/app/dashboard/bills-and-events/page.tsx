
"use client";

import { BillList } from "@/components/dashboard/bills/bill-list";

export default function BillsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-red-600">Bills & Events</h1>
      <BillList />
    </div>
  );
}
