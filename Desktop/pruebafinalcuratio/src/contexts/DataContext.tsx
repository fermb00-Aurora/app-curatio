import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { getDataStore } from '@/utils/storage/dataStore';
import type { Transaction, Category } from '@/utils/dataTypes';

interface DataContextType {
  transactions: Transaction[];
  categories: Category[];
  filteredTransactions: Transaction[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  setDateRange: (start: Date | null, end: Date | null) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const refreshData = useCallback(async () => {
    try {
      console.log("Starting data refresh...");
      setIsLoading(true);
      const { transactions: newTransactions, categories: newCategories } = await getDataStore();
      
      console.log(`Retrieved ${newTransactions.length} transactions and ${newCategories.length} categories`);
      
      setTransactions(newTransactions);
      setCategories(newCategories);
      
      // Apply date filtering to new transactions
      if (newTransactions.length > 0) {
        const filtered = newTransactions.filter(transaction => {
          if (!dateRange.start || !dateRange.end) return true;
          const transactionDate = new Date(transaction.fecha);
          return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
        });
        console.log(`Filtered ${filtered.length} transactions based on date range`);
        setFilteredTransactions(filtered);
      } else {
        console.log("No transactions to filter");
        setFilteredTransactions([]);
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast({
        title: t('error'),
        description: t('errorRefreshingData'),
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, toast, t]);

  // Initial data load
  useEffect(() => {
    if (!isInitialized) {
      console.log("Performing initial data load...");
      refreshData().then(() => {
        console.log("Initial data load completed");
        setIsInitialized(true);
      });
    }
  }, [refreshData, isInitialized]);

  // Update filtered transactions when date range changes
  useEffect(() => {
    if (transactions.length > 0) {
      console.log("Updating filtered transactions based on new date range");
      const filtered = transactions.filter(transaction => {
        if (!dateRange.start || !dateRange.end) return true;
        const transactionDate = new Date(transaction.fecha);
        return transactionDate >= dateRange.start && transactionDate <= dateRange.end;
      });
      console.log(`Filtered ${filtered.length} transactions`);
      setFilteredTransactions(filtered);
    } else {
      console.log("No transactions to filter");
      setFilteredTransactions([]);
    }
  }, [dateRange, transactions]);

  const handleSetDateRange = (start: Date | null, end: Date | null) => {
    console.log("Setting new date range:", { start, end });
    setDateRange({ start, end });
  };

  return (
    <DataContext.Provider value={{
      transactions,
      categories,
      filteredTransactions,
      isLoading,
      refreshData,
      setDateRange: handleSetDateRange
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
