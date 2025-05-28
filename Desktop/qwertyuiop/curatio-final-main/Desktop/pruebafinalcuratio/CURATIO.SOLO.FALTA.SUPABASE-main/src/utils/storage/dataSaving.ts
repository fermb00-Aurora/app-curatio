
import { STORAGE_KEYS } from './constants';
import { getTransactionsData, getCategoriesData, getLastUpdatedData } from './baseStorage';
import { mergeTransactionsData, mergeCategoriesData } from './dataMerging';
import type { Transaction, Category } from '../dataTypes';

/**
 * Save transactions data to localStorage with merge option
 */
export const saveTransactionsData = async (data: Transaction[], merge: boolean = false): Promise<void> => {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid transactions data format:", data);
    return;
  }
  
  let finalData = data;
  
  if (merge) {
    console.log(`Merging ${data.length} transactions with existing data`);
    const existingData = getTransactionsData();
    finalData = mergeTransactionsData(data, existingData);
  } else {
    console.log(`Replacing with ${data.length} transactions`);
  }
  
  console.log(`Saving ${finalData.length} transactions to localStorage`);
  if (finalData.length > 0) {
    console.log("Sample transaction being saved:", JSON.stringify(finalData[0]));
  }
  
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(finalData));
  
  // Update last updated timestamp
  const lastUpdated = getLastUpdatedData();
  const newLastUpdated = {
    ...lastUpdated,
    transactions: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEYS.lastUpdated, JSON.stringify(newLastUpdated));

  // Verify data was saved
  const savedData = localStorage.getItem(STORAGE_KEYS.transactions);
  if (savedData) {
    const parsedData = JSON.parse(savedData);
    console.log(`Verification: saved ${parsedData.length} transactions`);
  } else {
    console.error("Failed to save transactions - localStorage did not update");
  }

  // Dispatch a storage event for cross-tab communication
  window.dispatchEvent(new Event('storage'));
  console.log("Storage event dispatched after saving transactions");
};

/**
 * Save categories data to localStorage with merge option
 */
export const saveCategoriesData = async (data: Category[], merge: boolean = false): Promise<void> => {
  let finalData = data;
  
  if (merge) {
    console.log(`Merging ${data.length} categories with existing data`);
    const existingData = getCategoriesData();
    finalData = mergeCategoriesData(data, existingData);
  } else {
    console.log(`Replacing with ${data.length} categories`);
  }
  
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(finalData));
  
  // Update last updated timestamp
  const lastUpdated = getLastUpdatedData();
  const newLastUpdated = {
    ...lastUpdated,
    categories: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEYS.lastUpdated, JSON.stringify(newLastUpdated));

  // Dispatch a storage event for cross-tab communication
  window.dispatchEvent(new Event('storage'));
};

