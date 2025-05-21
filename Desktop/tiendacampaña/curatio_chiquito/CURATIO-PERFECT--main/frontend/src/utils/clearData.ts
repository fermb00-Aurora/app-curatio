import { supabase } from '../services/supabaseClient';

export const clearAllData = async () => {
  try {
    // 1. Clear Supabase Storage
    const { data: storageFiles, error: storageError } = await supabase
      .storage
      .from('userfiles')
      .list();

    if (storageError) {
      console.error('Error listing storage files:', storageError);
      return false;
    }

    // Delete all files from storage
    for (const file of storageFiles) {
      const { error: deleteError } = await supabase
        .storage
        .from('userfiles')
        .remove([file.name]);
      
      if (deleteError) {
        console.error(`Error deleting file ${file.name}:`, deleteError);
      }
    }

    // 2. Clear Local Storage
    localStorage.removeItem('processed_transacciones');
    localStorage.removeItem('processed_categorias');
    localStorage.removeItem('user_preferences');
    localStorage.removeItem('last_sync');

    console.log('All data cleared successfully');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
}; 