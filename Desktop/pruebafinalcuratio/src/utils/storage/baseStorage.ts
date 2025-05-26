import { supabase } from '@/services/supabaseClient';
import type { Transaction, Category } from '../dataTypes';

/**
 * Type for last updated data
 */
export interface LastUpdatedData {
  transactions: string | null;
  categories: string | null;
}

/**
 * Get transactions data from Supabase
 */
export const getTransactionsData = async (): Promise<Transaction[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return [];
    }

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getTransactionsData:", error);
    return [];
  }
};

/**
 * Get categories data from Supabase
 */
export const getCategoriesData = async (): Promise<Category[]> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return [];
    }

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching categories:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getCategoriesData:", error);
    return [];
  }
};

/**
 * Get last updated data from Supabase
 */
export const getLastUpdatedData = async (): Promise<LastUpdatedData> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated in getLastUpdatedData");
      return { transactions: null, categories: null };
    }

    const { data: metadata, error } = await supabase
      .from('user_metadata')
      .select('last_updated')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error("Error fetching user metadata:", error);
      // If no metadata exists, create it
      if (error.code === 'PGRST116') {
        const { error: insertError } = await supabase
          .from('user_metadata')
          .insert([{
            user_id: user.id,
            last_updated: {
              transactions: null,
              categories: null
            }
          }]);
        
        if (insertError) {
          console.error("Error creating user metadata:", insertError);
        }
        return { transactions: null, categories: null };
      }
      return { transactions: null, categories: null };
    }

    return metadata?.last_updated || { transactions: null, categories: null };
  } catch (error) {
    console.error("Error in getLastUpdatedData:", error);
    return { transactions: null, categories: null };
  }
};

/**
 * Clear all stored data for the current user
 */
export const clearAllData = async (): Promise<void> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return;
    }

    const promises = [
      supabase.from('transactions').delete().eq('user_id', user.id),
      supabase.from('categories').delete().eq('user_id', user.id),
      supabase.from('user_metadata').delete().eq('user_id', user.id)
    ];

    await Promise.all(promises);
  } catch (error) {
    console.error("Error in clearAllData:", error);
  }
};

