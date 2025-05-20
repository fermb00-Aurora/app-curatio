
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Transaction, Category, DataStore } from '@/utils/dataTypes';
import { 
  getDataStore, 
  initializeDataStore,
  filterDataByDateRange,
  STORAGE_KEYS
} from '@/utils/dataStorage';

interface DataContextType {
  dataStore: DataStore;
  filteredTransactions: Transaction[];
  refreshData: () => void;
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
  const [dataStore, setDataStore] = useState<DataStore>(() => initializeDataStore());
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [dateRange, setDateRangeState] = useState(() => ({
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 31)
  }));
  const [isLoading, setIsLoading] = useState(false);

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

    const handleStorageChange = () => {
      console.log("Storage change detected, refreshing data");
      refreshData();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
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

  const refreshData = () => {
    console.log("Refreshing data...");
    setIsLoading(true);
    try {
      const rawData = localStorage.getItem(STORAGE_KEYS.transactions);
      if (rawData) {
        console.log(`Retrieved ${JSON.parse(rawData).length} transactions from localStorage`);
      }
      
      const freshData = getDataStore();
      console.log(`Retrieved fresh data: ${freshData.transactions.length} transactions`);
      setDataStore(freshData);
      
      // Filtering will happen in the useEffect
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast({
        title: t('common.error'),
        description: t('upload.failedToRefreshData', 'Failed to refresh data'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const setDateRange = (startDate: Date, endDate: Date) => {
    console.log(`Setting date range: ${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
    setDateRangeState({ startDate, endDate });
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
