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
import axios from 'axios';
import { supabase } from '../../../frontend/src/services/supabaseClient';

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
  const [fileProgress, setFileProgress] = useState<Record<string, { progress: number; status: string; error?: string }>>({});

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

  const validateFiles = (files: File[]) => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length > 10) throw new Error('Máximo 10 archivos permitidos');
    if (totalSize > 100 * 1024 * 1024) throw new Error('Tamaño total máximo permitido: 100MB');
  };

  const uploadToStorage = async (file: File, fileId: string) => {
    const path = `${type}/${Date.now()}_${file.name}`;
    setFileProgress(prev => ({ ...prev, [fileId]: { progress: 0, status: 'uploading' } }));
    try {
      const { data, error } = await supabase.storage
        .from('userfiles')
        .upload(path, file, {
          onUploadProgress: (progress) => {
            const percent = (progress.loaded / progress.total) * 100;
            setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], progress: percent } }));
          },
        });
      if (error) throw error;
      setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], progress: 100, status: 'uploaded' } }));
      return data.path;
    } catch (error) {
      setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error', error: error.message } }));
      throw error;
    }
  };

  const processAndSendMetadata = async (file: File, storagePath: string, fileId: string) => {
    setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'processing' } }));
    try {
      // Read and process file as before
      const data = await readSpreadsheetFile(file, () => {});
      const detectedType = detectFileType(data);
      if (detectedType !== type) throw new Error('Tipo de archivo no coincide');
      let processedData;
      if (type === 'transactions') {
        processedData = processTransactionsFile(data);
      } else {
        processedData = processCategoriesFile(data);
      }
      // Send metadata to backend
      await axios.post('/api/uploads', {
        file_name: file.name,
        file_type: file.type,
        storage_path: storagePath,
        size: file.size,
        data_type: type,
        is_incremental: incrementalMode,
        processed_data: processedData
      });
      setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'complete', progress: 100 } }));
    } catch (error) {
      setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error', error: error.message } }));
      throw error;
    }
  };

  const handleFiles = async (files: File[]) => {
    try {
      validateFiles(files);
      const fileIds = files.map(() => Math.random().toString(36).substr(2, 9));
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileId = fileIds[i];
        try {
          const storagePath = await uploadToStorage(file, fileId);
          await processAndSendMetadata(file, storagePath, fileId);
          toast({ title: t('common.success'), description: `${file.name} procesado correctamente` });
        } catch (error) {
          toast({ title: t('common.error'), description: `Error procesando ${file.name}: ${error.message}`, variant: 'destructive' });
        }
      }
    } catch (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => handleFiles(acceptedFiles),
    disabled: isUploading,
    multiple: allowMultiple,
    accept: type === 'transactions'
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
              {/* Progress Indicators */}
              {Object.entries(fileProgress).map(([fileId, info]) => (
                <div key={fileId} className="border rounded p-4 my-2">
                  <div className="flex justify-between mb-2">
                    <span className="font-medium">{info.status === 'error' ? '❌' : info.status === 'complete' ? '✅' : '⬆️'} {fileId}</span>
                    <span className="text-sm text-gray-500">
                      {info.status === 'uploading' ? 'Subiendo...' :
                       info.status === 'processing' ? 'Procesando...' :
                       info.status === 'complete' ? 'Completado' :
                       'Error'}
                    </span>
                  </div>
                  <Progress value={info.progress} className="h-2" />
                  {info.error && (
                    <p className="text-sm text-red-500 mt-2">{info.error}</p>
                  )}
                </div>
              ))}
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
