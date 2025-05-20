
import { STORAGE_KEYS } from './constants';
import { getTransactionsData, getCategoriesData, getLastUpdatedData, clearAllData } from './baseStorage';
import { extractAvailableDates, extractUniqueCategories, filterDataByDateRange } from './dataExtraction';
import { mergeTransactionsData, mergeCategoriesData } from './dataMerging';
import { saveTransactionsData, saveCategoriesData } from './dataSaving';
import type { DataStore } from '../dataTypes';

/**
 * Initialize a new data store with default values
 */
export const initializeDataStore = (): DataStore => {
  return {
    transactions: getTransactionsData(),
    categories: getCategoriesData(),
    availableDates: extractAvailableDates(getTransactionsData()),
    uniqueCategories: extractUniqueCategories(getCategoriesData()),
    lastUpdated: getLastUpdatedData()
  };
};

/**
 * Get the current data store state
 */
export const getDataStore = (): DataStore => {
  const transactions = getTransactionsData();
  const categories = getCategoriesData();
  
  console.log(`getDataStore called, retrieved ${transactions.length} transactions and ${categories.length} categories`);
  if (transactions.length > 0) {
    console.log("Sample first transaction:", JSON.stringify(transactions[0]));
  }
  
  return {
    transactions,
    categories,
    availableDates: extractAvailableDates(transactions),
    uniqueCategories: extractUniqueCategories(categories),
    lastUpdated: getLastUpdatedData()
  };
};

export {
  STORAGE_KEYS,
  getTransactionsData,
  getCategoriesData,
  getLastUpdatedData,
  clearAllData,
  extractAvailableDates,
  extractUniqueCategories,
  filterDataByDateRange,
  mergeTransactionsData,
  mergeCategoriesData,
  saveTransactionsData,
  saveCategoriesData
};

