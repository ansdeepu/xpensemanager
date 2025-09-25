
"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { addMonths, subMonths } from "date-fns";

type ReportDateContextType = {
  currentDate: Date;
  setCurrentDate: React.Dispatch<React.SetStateAction<Date>>;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
};

const ReportDateContext = createContext<ReportDateContextType | undefined>(undefined);

export function ReportDateProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const goToPreviousMonth = () => setCurrentDate(prev => subMonths(prev, 1));
  const goToNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

  const value = {
    currentDate,
    setCurrentDate,
    goToPreviousMonth,
    goToNextMonth,
  };

  return (
    <ReportDateContext.Provider value={value}>
      {children}
    </ReportDateContext.Provider>
  );
}

export function useReportDate() {
  const context = useContext(ReportDateContext);
  if (context === undefined) {
    // Return a default state if the context is not available
    // This can happen if a component using the hook is not wrapped in the provider
    // (e.g., the Header component on non-report pages)
    return {
      currentDate: new Date(),
      setCurrentDate: () => {},
      goToPreviousMonth: () => {},
      goToNextMonth: () => {},
    };
  }
  return context;
}
