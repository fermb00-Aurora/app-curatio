import { supabase } from '@/services/supabaseClient';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB in bytes
const MAX_FILES = 10;

export interface UploadResult {
  success: boolean;
  error?: string;
  data?: any;
  path?: string;
}

export const uploadToSupabase = async (
  file: File,
  type: 'transactions' | 'categories',
  onProgress?: (progress: number) => void
): Promise<UploadResult> => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: 'File size exceeds 100MB limit'
      };
    }

    // Generate a unique file path with user ID
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const filePath = `${user.id}/${type}/${timestamp}-${file.name}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    // Get the signed URL (private access)
    const { data: { signedUrl } } = await supabase.storage
      .from('uploads')
      .createSignedUrl(filePath, 3600); // URL valid for 1 hour

    return {
      success: true,
      data,
      path: signedUrl
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

export const validateFiles = (files: File[]): { valid: boolean; error?: string } => {
  if (files.length > MAX_FILES) {
    return {
      valid: false,
      error: `Maximum ${MAX_FILES} files allowed`
    };
  }

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);
  if (totalSize > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Total file size exceeds 100MB limit'
    };
  }

  return { valid: true };
};

export const deleteFromSupabase = async (path: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Verify the file belongs to the user
    if (!path.includes(user.id)) {
      return {
        success: false,
        error: 'Unauthorized to delete this file'
      };
    }

    const { error } = await supabase.storage
      .from('uploads')
      .remove([path]);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

export const listUserFiles = async (type: 'transactions' | 'categories'): Promise<{ success: boolean; data?: any[]; error?: string }> => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    const { data, error } = await supabase.storage
      .from('uploads')
      .list(`${user.id}/${type}`);

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}; 