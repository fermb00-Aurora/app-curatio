
import { useState, useMemo, useEffect, Dispatch, SetStateAction } from 'react';
import { Transaction } from '@/utils/dataTypes';

interface UseTransactionTableProps<T> {
  items: T[];
  itemsPerPage?: number;
  searchKey?: keyof T;
}

interface UseTransactionTableResult<T> {
  paginatedItems: T[];
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  filteredItems: T[];
  setFilteredItems: Dispatch<SetStateAction<T[]>>;
}

export const useTransactionTable = <T,>(
  transactions: Transaction[]
): {
  paginatedTransactions: Transaction[];
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  totalPages: number;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
} => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const ITEMS_PER_PAGE = 15;

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((transaction) =>
        transaction.clienteDescripcion.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [transactions, searchTerm]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTransactions.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);

  // Reset to page 1 if we're on a page that no longer exists after filtering
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  return {
    paginatedTransactions,
    currentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
  };
};

export function useGenericTable<T>({
  items,
  itemsPerPage = 10,
  searchKey
}: UseTransactionTableProps<T>): UseTransactionTableResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState<T[]>(items);

  // Update filtered items when items change
  useEffect(() => {
    setFilteredItems(items);
  }, [items]);

  // Filter items based on search term
  useEffect(() => {
    if (!searchTerm || !searchKey) {
      setFilteredItems(items);
      return;
    }

    const filtered = items.filter(item => {
      const value = item[searchKey];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return false;
    });
    
    setFilteredItems(filtered);
    // Reset to page 1 when search changes
    setCurrentPage(1);
  }, [items, searchTerm, searchKey]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  // Get paginated items
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  return {
    paginatedItems,
    currentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
    filteredItems,
    setFilteredItems
  };
}
