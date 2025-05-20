
import * as XLSX from 'xlsx';

/**
 * Reads a spreadsheet file (Excel or ODS) and converts it to JSON data
 * Shows a progress notification during the process
 */
export const readSpreadsheetFile = async (
  file: File, 
  onProgress?: (progress: number) => void
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    // Update progress when file reading starts
    reader.onloadstart = () => {
      onProgress?.(10);
      console.log("Starting to read file:", file.name);
    };
    
    // Update progress during read
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 40) + 10;
        onProgress?.(progress);
      }
    };
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        onProgress?.(50);
        console.log("File read complete, parsing data...");
        
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        console.log("Sheet name:", sheetName);
        onProgress?.(70);
        
        // Use more robust settings for Spanish Excel files
        const json = XLSX.utils.sheet_to_json(worksheet, { 
          raw: false,
          defval: '',  // Default value for empty cells
          blankrows: false  // Skip blank rows
        });
        
        console.log(`Successfully converted to JSON, got ${json.length} rows`);
        console.log("First row sample:", json.length > 0 ? JSON.stringify(json[0]) : "No data");
        
        onProgress?.(90);
        
        // Small delay to allow UI to update
        setTimeout(() => {
          onProgress?.(100);
          resolve(json);
        }, 300);
      } catch (error) {
        console.error("Error parsing file:", error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error("File read error:", error);
      reject(error);
    };
    
    console.log("Starting to read file as array buffer...");
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Delete the source file after processing (client-side deletion for upload cleanup)
 */
export const cleanupSourceFile = (fileInput: HTMLInputElement | null): void => {
  if (fileInput) {
    fileInput.value = '';
  }
};
