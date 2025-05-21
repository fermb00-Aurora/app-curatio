
import React from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/contexts/AppContext";
import Sidebar from "./Sidebar";
import DateFilter from "../common/DateFilter";
import { format } from "date-fns";

interface MainLayoutProps {
  children: React.ReactNode;
  title: string;
  showDateFilter?: boolean;
  rightHeaderContent?: React.ReactNode;
  onDateRangeChange?: (range: { from: Date; to: Date }) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  title,
  showDateFilter = true,
  rightHeaderContent,
  onDateRangeChange,
}) => {
  const { state } = useAppContext();
  const { t } = useTranslation();
  
  const formattedDateTime = format(
    state.currentDateTime,
    "dd/MM/yyyy HH:mm"
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar onDateRangeChange={onDateRangeChange} />
      
      <div className="flex-1 flex flex-col">
        {/* Header with date/time */}
        <header className="py-4 px-6 bg-white border-b flex justify-between items-center">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <div className="flex items-center gap-4">
            {rightHeaderContent}
            <span className="text-gray-500">{formattedDateTime}</span>
          </div>
        </header>
        
        {/* Date filter */}
        {showDateFilter && (
          <div className="bg-white border-b py-3 px-6">
            <DateFilter />
          </div>
        )}
        
        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
