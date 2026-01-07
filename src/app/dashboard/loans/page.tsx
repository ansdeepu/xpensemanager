
"use client";

import { LoanList } from "@/components/dashboard/loans/loan-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LoansPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="taken" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="taken">Loan Taken</TabsTrigger>
          <TabsTrigger value="given">Loan Given</TabsTrigger>
        </TabsList>
        <TabsContent value="taken" className="mt-6">
          <LoanList loanType="taken" />
        </TabsContent>
        <TabsContent value="given" className="mt-6">
          <LoanList loanType="given" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
