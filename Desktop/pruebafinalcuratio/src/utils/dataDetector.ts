
import type { Transaction, Category } from './dataTypes';

/**
 * Detect file type based on structure
 */
export const detectFileType = (data: any[]): 'transactions' | 'categories' | null => {
  if (!data || !data[0]) return null;
  
  // Check for transaction file indicators
  if (
    data[0].hasOwnProperty('Fecha') ||
    data[0].hasOwnProperty('Vendedor') ||
    data[0].hasOwnProperty('Tipo de Pago')
  ) {
    return 'transactions';
  }
  
  // Check for categories file indicators
  if (
    data[0].hasOwnProperty('Código') ||
    data[0].hasOwnProperty('Familia') ||
    data[0].hasOwnProperty('Descripción')
  ) {
    return 'categories';
  }
  
  return null;
};

/**
 * Extract the unique dates from transactions data
 * Used for calendar filtering to only show dates with data
 */
export const extractAvailableDates = (transactions: Transaction[]): Date[] => {
  if (!transactions || !transactions.length) return [];
  
  const uniqueDatesSet = new Set<string>();
  
  transactions.forEach(transaction => {
    if (transaction.fecha) {
      uniqueDatesSet.add(transaction.fecha);
    }
  });
  
  // Convert date strings to Date objects
  return Array.from(uniqueDatesSet)
    .map(dateStr => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      
      // Parse dd/mm/yyyy format
      return new Date(
        parseInt(parts[2]), // year
        parseInt(parts[1]) - 1, // month (0-indexed)
        parseInt(parts[0]) // day
      );
    })
    .filter((date): date is Date => date !== null);
};

/**
 * Extract unique categories from products data
 */
export const extractCategories = (categories: Category[]): string[] => {
  if (!categories || !categories.length) return [];
  
  const uniqueCategories = Array.from(
    new Set(categories.map(c => c.familia))
  ).filter(Boolean) as string[];
  
  return uniqueCategories.sort();
};
