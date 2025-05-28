import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import type { Transaction, Category, DataStore } from '@/utils/dataTypes';
import { extractAvailableDates, extractUniqueCategories, filterDataByDateRange } from '@/utils/storage/dataExtraction';
import { useAuth } from './AuthContext';
import { supabase } from '@/services/supabaseClient';

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
  const { user } = useAuth();
  const [dataStore, setDataStore] = useState<DataStore>({
    transactions: [],
    categories: [],
    availableDates: [],
    uniqueCategories: [],
    lastUpdated: { transactions: null, categories: null },
  });
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [dateRange, setDateRangeState] = useState(() => ({
    startDate: new Date(2025, 2, 1),
    endDate: new Date(2025, 2, 31)
  }));
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data from Supabase
  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [transactionsRes, categoriesRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
      ]);
      if (transactionsRes.error || categoriesRes.error) {
        throw transactionsRes.error || categoriesRes.error;
      }
      setDataStore({
        transactions: transactionsRes.data || [],
        categories: categoriesRes.data || [],
        availableDates: extractAvailableDates(transactionsRes.data || []),
        uniqueCategories: extractUniqueCategories(categoriesRes.data || []),
        lastUpdated: { transactions: null, categories: null },
      });
    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
      toast({
        title: t('common.error'),
        description: error.message || 'Failed to fetch data from Supabase',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line
  }, [user]);

  // Filter transactions whenever dateRange or dataStore changes
  useEffect(() => {
    if (dataStore.transactions && dataStore.transactions.length) {
      const startDate = dateRange.startDate;
      const endDate = dateRange.endDate;
      const filtered = filterDataByDateRange(dataStore.transactions, startDate, endDate);
      setFilteredTransactions(filtered);
    } else {
      setFilteredTransactions([]);
    }
  }, [dataStore.transactions, dateRange]);

  const refreshData = () => {
    fetchData();
  };

  const setDateRange = (startDate: Date, endDate: Date) => {
    setDateRangeState({ startDate, endDate });
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
