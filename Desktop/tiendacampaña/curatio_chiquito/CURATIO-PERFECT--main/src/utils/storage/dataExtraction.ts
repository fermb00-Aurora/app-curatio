
import type { Transaction, Category } from '../dataTypes';

/**
 * Extract all unique dates from transactions data
 */
export const extractAvailableDates = (transactions: Transaction[]): Date[] => {
  if (!transactions || transactions.length === 0) {
    console.log("No transactions data to extract dates from");
    return [];
  }
  
  const uniqueDatesSet = new Set<string>();
  
  transactions.forEach(transaction => {
    if (transaction.fecha) {
      uniqueDatesSet.add(transaction.fecha);
    }
  });
  
  // Log all unique date strings for debugging
  console.log("Unique date strings:", Array.from(uniqueDatesSet));
  
  const dates = Array.from(uniqueDatesSet).map(dateString => {
    try {
      // Convert Spanish date format (DD/MM/YYYY) to Date object
      const [day, month, year] = dateString.split('/').map(Number);
      return new Date(year, month - 1, day);
    } catch (error) {
      console.error(`Error parsing date: ${dateString}`, error);
      return null;
    }
  })
  .filter((date): date is Date => date !== null)
  .sort((a, b) => a.getTime() - b.getTime());
  
  console.log(`Extracted ${dates.length} unique dates from transactions`);
  // Log the first few parsed dates
  if (dates.length > 0) {
    console.log("First few dates:", dates.slice(0, 3).map(d => d.toLocaleDateString()));
  }
  
  return dates;
};

/**
 * Extract all unique product categories
 */
export const extractUniqueCategories = (categories: Category[]): string[] => {
  const uniqueCategoriesSet = new Set<string>();
  
  categories.forEach(category => {
    if (category.familia) {
      uniqueCategoriesSet.add(category.familia);
    }
  });
  
  return Array.from(uniqueCategoriesSet).sort();
};

/**
 * Filter transactions by date range
 */
export const filterDataByDateRange = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] => {
  if (!transactions || transactions.length === 0) {
    console.log("No transactions to filter");
    return [];
  }

  // Ensure dates are set to the beginning and end of the day
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  console.log(`Filtering ${transactions.length} transactions between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}`);

  // First check if our date parsing is working
  const transactionsWithValidDates = transactions.filter(t => {
    try {
      if (!t.fecha) return false;
      const [day, month, year] = t.fecha.split('/').map(Number);
      return !isNaN(day) && !isNaN(month) && !isNaN(year);
    } catch (e) {
      return false;
    }
  });
  
  console.log(`${transactionsWithValidDates.length} of ${transactions.length} transactions have valid dates`);
  
  // Now actually filter by date range
  const filtered = transactions.filter(transaction => {
    if (!transaction.fecha) return false;
    
    try {
      // Parse the Spanish date format (DD/MM/YYYY)
      const [day, month, year] = transaction.fecha.split('/').map(Number);
      const transactionDate = new Date(year, month - 1, day);
      
      return transactionDate >= start && transactionDate <= end;
    } catch (error) {
      console.error(`Error filtering date: ${transaction.fecha}`, error);
      return false;
    }
  });
  
  console.log(`Filtered to ${filtered.length} transactions`);
  return filtered;
};

