
import type { Transaction, Category } from '../dataTypes';

/**
 * Merge new transactions with existing ones
 * Uses transaction number and date as unique identifiers
 */
export const mergeTransactionsData = (newData: Transaction[], existingData: Transaction[] = []): Transaction[] => {
  console.log(`Merging ${newData.length} new transactions with ${existingData.length} existing ones`);
  
  // Create a Map of existing transactions for quick lookup
  const existingMap = new Map<string, Transaction>();
  
  existingData.forEach(transaction => {
    // Create a unique key using date, transaction number and product code
    const key = `${transaction.fecha}_${transaction.numeroDoc}_${transaction.codigo}`;
    existingMap.set(key, transaction);
  });
  
  // Add new transactions, replacing existing ones if they have the same key
  newData.forEach(transaction => {
    const key = `${transaction.fecha}_${transaction.numeroDoc}_${transaction.codigo}`;
    existingMap.set(key, transaction);
  });
  
  const mergedData = Array.from(existingMap.values());
  console.log(`Merged data contains ${mergedData.length} transactions`);
  
  return mergedData;
};

/**
 * Merge new categories with existing ones
 * Uses product code as unique identifier
 */
export const mergeCategoriesData = (newData: Category[], existingData: Category[] = []): Category[] => {
  console.log(`Merging ${newData.length} new categories with ${existingData.length} existing ones`);
  
  // Create a Map of existing categories for quick lookup
  const existingMap = new Map<string, Category>();
  
  existingData.forEach(category => {
    existingMap.set(category.codigo, category);
  });
  
  // Add new categories, replacing existing ones if they have the same code
  newData.forEach(category => {
    existingMap.set(category.codigo, category);
  });
  
  const mergedData = Array.from(existingMap.values());
  console.log(`Merged data contains ${mergedData.length} categories`);
  
  return mergedData;
};

