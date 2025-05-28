// ... existing code ...
// Remove all functions and code that use localStorage for transactions or categories.
// Refactor or delete this file if it is no longer needed.
// ... existing code ...

import { STORAGE_KEYS } from './constants';
import type { Transaction, Category } from '../dataTypes';

/**
 * Type for last updated data
 */
export interface LastUpdatedData {
  transactions: string | null;
  categories: string | null;
}

/**
 * Get transactions data from localStorage
 */
export const getTransactionsData = (): Transaction[] => {
  const data = localStorage.getItem(STORAGE_KEYS.transactions);
  if (!data) {
    console.log("No transactions data found in localStorage");
    return [];
  }
  
  try {
    const parsedData = JSON.parse(data);
    console.log(`Retrieved ${parsedData.length} transactions from localStorage`);
    return parsedData;
  } catch (error) {
    console.error("Error parsing transactions data from localStorage:", error);
    return [];
  }
};

/**
 * Get categories data from localStorage
 */
export const getCategoriesData = (): Category[] => {
  const data = localStorage.getItem(STORAGE_KEYS.categories);
  if (!data) return [];
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error("Error parsing categories data from localStorage:", error);
    return [];
  }
};

/**
 * Get last updated data
 */
export const getLastUpdatedData = (): LastUpdatedData => {
  const data = localStorage.getItem(STORAGE_KEYS.lastUpdated);
  return data ? JSON.parse(data) : { transactions: null, categories: null };
};

/**
 * Clear all stored data
 */
export const clearAllData = (): void => {
  localStorage.removeItem(STORAGE_KEYS.transactions);
  localStorage.removeItem(STORAGE_KEYS.categories);
  localStorage.removeItem(STORAGE_KEYS.lastUpdated);
};

