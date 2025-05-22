import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Transaction, Category, DataStore } from '@/utils/dataTypes';
import { 
  getDataStore, 
  initializeDataStore,
  filterDataByDateRange,
} from '@/utils/dataStorage';

interface DataContextType {
  dataStore: DataStore;
  filteredTransactions: Transaction[];
  refreshData: () => Promise<void>;
  isLoading: boolean;
  setDateRange: (start: Date, end: Date) => void;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const useDataContext = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  return context;
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [dataStore, setDataStore] = useState<DataStore>({ 
    transactions: [], 
    categories: [], 
    availableDates: [], 
    uniqueCategories: [],
    lastUpdated: { transactions: null, categories: null }
  });
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [dateRange, setDateRangeState] = useState(() => ({
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 31)
  }));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const addTranslations = () => {
      try {
        const newTranslations = {
          upload: {
            incrementalMode: "Modo incremental",
            incrementalModeDescription: "Añadir nuevos datos sin eliminar los existentes",
            replaceModeDescription: "Reemplazar datos existentes",
            fileIncrementalProcessed: "Archivo procesado e integrado con datos existentes"
          }
        };
        
        console.log("Translation keys for incremental updates:", JSON.stringify(newTranslations));
      } catch (error) {
        console.error("Error setting up translations:", error);
      }
    };
    
    addTranslations();
  }, []);

  useEffect(() => {
    console.log("DataContext initialized, refreshing data");
    refreshData();
  }, []);

  // Filter transactions whenever dateRange changes
  useEffect(() => {
    if (dataStore.transactions && dataStore.transactions.length) {
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      
      console.log(`Filtering transactions by date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
      
      const filtered = filterDataByDateRange(dataStore.transactions, startDate, endDate);
      console.log(`Filtered ${filtered.length} out of ${dataStore.transactions.length} transactions`);
      
      setFilteredTransactions(filtered);
    } else {
      console.log("No transactions to display");
      setFilteredTransactions([]);
    }
  }, [dataStore.transactions, dateRange]);

  const refreshData = async () => {
    try {
      setIsLoading(true);
      const newDataStore = await getDataStore();
      setDataStore(newDataStore);
      
      const filtered = filterDataByDateRange(
        newDataStore.transactions,
        dateRange.startDate,
        dateRange.endDate
      );
      setFilteredTransactions(filtered);
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: t('errors.dataRefreshFailed'),
        description: t('errors.tryAgain'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setDateRange = (startDate: Date, endDate: Date) => {
    setDateRangeState({ startDate, endDate });
    const filtered = filterDataByDateRange(
      dataStore.transactions,
      startDate,
      endDate
    );
    setFilteredTransactions(filtered);
  };

  console.log("DataProvider rendering with", filteredTransactions.length, "filtered transactions");

  return (
    <DataContext.Provider
      value={{
        dataStore,
        filteredTransactions,
        refreshData,
        isLoading,
        setDateRange,
        dateRange,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};
