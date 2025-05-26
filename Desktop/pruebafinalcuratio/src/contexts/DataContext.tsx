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
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize translations
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

  // Initial data load
  useEffect(() => {
    if (!isInitialized) {
      console.log("DataContext: Initial data load");
      refreshData();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Filter transactions whenever dateRange changes
  useEffect(() => {
    if (!dataStore.transactions || dataStore.transactions.length === 0) {
      console.log("No transactions data to filter");
      setFilteredTransactions([]);
      return;
    }

    const startDate = dateRange.startDate;
    const endDate = dateRange.endDate;
    
    console.log(`Filtering transactions by date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
    
    const filtered = filterDataByDateRange(dataStore.transactions, startDate, endDate);
    console.log(`Filtered ${filtered.length} out of ${dataStore.transactions.length} transactions`);
    
    setFilteredTransactions(filtered);
  }, [dataStore.transactions, dateRange]);

  const refreshData = async () => {
    try {
      console.log("DataContext: Starting data refresh");
      setIsLoading(true);
      
      const newDataStore = await getDataStore();
      console.log("DataContext: Retrieved new data store", {
        transactionsCount: newDataStore.transactions.length,
        categoriesCount: newDataStore.categories.length,
        lastUpdated: newDataStore.lastUpdated
      });
      
      setDataStore(newDataStore);
      
      const filtered = filterDataByDateRange(
        newDataStore.transactions,
        dateRange.startDate,
        dateRange.endDate
      );
      setFilteredTransactions(filtered);
      
      console.log("DataContext: Data refresh completed successfully");
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
    console.log("DataContext: Updating date range", {
      startDate: startDate.toLocaleDateString(),
      endDate: endDate.toLocaleDateString()
    });
    
    setDateRangeState({ startDate, endDate });
    
    if (dataStore.transactions && dataStore.transactions.length > 0) {
      const filtered = filterDataByDateRange(
        dataStore.transactions,
        startDate,
        endDate
      );
      setFilteredTransactions(filtered);
    }
  };

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
