import { supabase } from '@/services/supabaseClient';
import type { Transaction, Category } from '../dataTypes';

/**
 * Save transactions data to Supabase with merge option
 */
export const saveTransactionsData = async (data: Transaction[], merge: boolean = false): Promise<void> => {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid transactions data format:", data);
    return;
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return;
    }

    const { data: existingData, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error("Error fetching existing data:", fetchError);
      return;
    }

    let finalData = data;
    if (merge && existingData) {
      // Implement merge logic here if needed
      finalData = [...existingData, ...data];
    }

    const { error: upsertError } = await supabase
      .from('transactions')
      .upsert(
        finalData.map(item => ({
          ...item,
          user_id: user.id
        }))
      );

    if (upsertError) {
      console.error("Error saving transactions:", upsertError);
      return;
    }

    console.log(`Saved ${finalData.length} transactions to Supabase`);
  } catch (error) {
    console.error("Error in saveTransactionsData:", error);
  }
};

/**
 * Save categories data to Supabase with merge option
 */
export const saveCategoriesData = async (data: Category[], merge: boolean = false): Promise<void> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return;
    }

    const { data: existingData, error: fetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      console.error("Error fetching existing data:", fetchError);
      return;
    }

    let finalData = data;
    if (merge && existingData) {
      // Implement merge logic here if needed
      finalData = [...existingData, ...data];
    }

    const { error: upsertError } = await supabase
      .from('categories')
      .upsert(
        finalData.map(item => ({
          ...item,
          user_id: user.id
        }))
      );

    if (upsertError) {
      console.error("Error saving categories:", upsertError);
      return;
    }

    console.log(`Saved ${finalData.length} categories to Supabase`);
  } catch (error) {
    console.error("Error in saveCategoriesData:", error);
  }
};

