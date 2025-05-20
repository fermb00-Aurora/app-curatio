import React, { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { readSpreadsheetFile, cleanupSourceFile } from "@/utils/fileConverter";
import { detectFileType } from "@/utils/dataDetector";
import { processTransactionsFile, processCategoriesFile } from "@/utils/dataProcessor";
import { saveTransactionsData, saveCategoriesData, STORAGE_KEYS } from "@/utils/dataStorage";
import { useDataContext } from "@/contexts/DataContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { mergeTransactionsData, mergeCategoriesData } from "@/utils/dataStorage";

interface ChunkedUploaderProps {
  type: "transactions" | "categories";
  onUploadComplete: (file: File, previewData: any[]) => void;
  allowMultiple?: boolean;
}

export const ChunkedUploader: React.FC<ChunkedUploaderProps> = ({ 
  type, 
  onUploadComplete,
  allowMultiple = false 
}) => {
  const { t } = useTranslation();
  const { refreshData } = useDataContext();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [incrementalMode, setIncrementalMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log(`Starting upload of ${file.name}, size: ${file.size} bytes, incremental mode: ${incrementalMode}`);
      
      // Read the spreadsheet file and show progress
      const data = await readSpreadsheetFile(file, (progress) => {
        setUploadProgress(progress);
        console.log(`Upload progress: ${progress}%`);
      });
      
      console.log(`Read ${data.length} rows from file`);
      if (data.length > 0) {
        console.log("First row sample:", JSON.stringify(data[0]));
      }

      // Detect file type and verify it matches the expected type
      const detectedType = detectFileType(data);
      console.log(`Detected file type: ${detectedType}, expected: ${type}`);
      
      if (detectedType !== type) {
        toast({
          title: t("common.error"),
          description: t("upload.typeFileMismatch"),
          variant: "destructive",
        });
        setIsUploading(false);
        setUploadProgress(0);
        return;
      }

      // Process incoming data
      let processedData;
      if (type === "transactions") {
        processedData = processTransactionsFile(data);
      } else {
        processedData = processCategoriesFile(data);
      }
      console.log(`Processed ${processedData.length} items for type ${type}`);

      // Incremental mode: Merge uploaded data with what is already in storage
      if (incrementalMode) {
        // Get existing data from localStorage, merge-in, and save
        const storageKey = type === "transactions" ? "processed_transacciones" : "processed_categorias";
        const previousJson = localStorage.getItem(storageKey);
        let previous = previousJson ? JSON.parse(previousJson) : [];
        let merged;
        if (type === "transactions") {
          merged = mergeTransactionsData(processedData, previous);
        } else {
          merged = mergeCategoriesData(processedData, previous);
        }
        // Store result back
        localStorage.setItem(storageKey, JSON.stringify(merged));
        console.log(`Merged and saved; now ${merged.length} data rows in ${storageKey}`);

        // Always set preview to the last uploaded chunk, not the entire merged
        onUploadComplete(file, processedData.slice(0, 5));
      } else {
        // Replace mode: just save the processed data from this file
        const storageKey = type === "transactions" ? "processed_transacciones" : "processed_categorias";
        localStorage.setItem(storageKey, JSON.stringify(processedData));
        onUploadComplete(file, processedData.slice(0, 5));
      }

      cleanupSourceFile(fileInputRef.current);

      toast({
        title: t("common.success"),
        description: t("upload.fileProcessedSuccess"),
      });

    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: t("common.error"),
        description: t("upload.error"),
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      // Handle single or multiple files based on allowMultiple prop
      const filesToProcess = allowMultiple ? files : [files[0]];
      
      for (const file of filesToProcess) {
        if (!file) continue;
        
        // For transactions, only allow Excel
        const isExcel = file.name.endsWith('.xlsx');
        const isOds = file.name.endsWith('.ods');
        
        // Check file format based on type
        if (type === "transactions") {
          if (!isExcel) {
            toast({
              title: t("common.error"),
              description: t("upload.transactionsExcelOnly"),
              variant: "destructive"
            });
            continue;
          }
        } else {
          // For categories, allow Excel and ODS
          if (!isExcel && !isOds) {
            toast({
              title: t("common.error"),
              description: t("upload.invalidFormat"),
              variant: "destructive"
            });
            continue;
          }
        }
        
        await handleUpload(file);
        
        // If not allowing multiple, process only the first file
        if (!allowMultiple) break;
      }
    },
    disabled: isUploading,
    multiple: allowMultiple,
    accept: type === "transactions" 
      ? { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
      : {
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          'application/vnd.oasis.opendocument.spreadsheet': ['.ods']
        }
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Switch
          id="incremental-mode"
          checked={incrementalMode}
          onCheckedChange={setIncrementalMode}
        />
        <Label htmlFor="incremental-mode">
          {t("upload.incrementalMode")}
        </Label>
      </div>
      
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-500"}
          ${isUploading ? "pointer-events-none opacity-80" : ""}`}
      >
        <input {...getInputProps()} ref={fileInputRef} />
        <div className="flex flex-col items-center justify-center">
          {isUploading ? (
            <div className="w-full space-y-4">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-sm text-gray-500">
                {uploadProgress < 100 
                  ? `${t("upload.uploading")} ${Math.round(uploadProgress)}%`
                  : t("upload.processing")}
              </p>
            </div>
          ) : (
            <>
              <svg
                className="h-12 w-12 text-gray-400 mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-gray-600 mb-1">
                {isDragActive ? t("upload.dropFilesHere") : t("upload.dragAndDrop")}
              </p>
              <p className="text-xs text-gray-500">
                {type === "transactions" 
                  ? t("upload.allowedTransactionsFormats") 
                  : t("upload.allowedCategoriesFormats")}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {incrementalMode 
                  ? t("upload.incrementalModeDescription") 
                  : t("upload.replaceModeDescription")}
              </p>
              {allowMultiple && (
                <p className="text-xs text-green-600 mt-1">
                  {t("upload.multipleFilesAllowed")}
                </p>
              )}
              <button
                type="button"
                className="mt-2 text-blue-700 hover:underline focus:outline-none text-sm"
                onClick={e => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                tabIndex={0}
              >
                {t("upload.browseFiles")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
