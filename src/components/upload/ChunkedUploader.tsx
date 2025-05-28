import React, { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { readSpreadsheetFile, cleanupSourceFile } from "@/utils/fileConverter";
import { detectFileType } from "@/utils/dataDetector";
import { processTransactionsFile, processCategoriesFile } from "@/utils/dataProcessor";
import { 
  saveTransactionsData, 
  saveCategoriesData, 
  STORAGE_KEYS, 
  getTransactionsData, 
  getCategoriesData, 
  mergeTransactionsData, 
  mergeCategoriesData 
} from "@/utils/dataStorage";
import { useDataContext } from "@/contexts/DataContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ChunkedUploaderProps {
  type: "transactions" | "categories";
  onUploadComplete: (file: File, previewData: any[]) => void;
  allowMultiple?: boolean;
}

export const ChunkedUploader: React.FC<ChunkedUploaderProps> = ({ 
  type, 
  onUploadComplete,
  allowMultiple = true
}) => {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      console.log(`Starting upload of ${file.name}, size: ${file.size} bytes`);
      
      const data = await readSpreadsheetFile(file, (progress) => {
        setUploadProgress(progress);
      });
      
      if (data.length === 0) {
         toast({ title: t("common.warning"), description: t("upload.emptyFile"), variant: "default" });
         setIsUploading(false);
         return;
      }
      console.log(`Read ${data.length} rows from file`);

      const detectedType = detectFileType(data);
      if (detectedType && detectedType !== type) {
        toast({ title: t("common.error"), description: t("upload.typeFileMismatch"), variant: "destructive" });
        setIsUploading(false); return;
      }

      let processedData;
      if (type === "transactions") {
        processedData = processTransactionsFile(data);
      } else {
        processedData = processCategoriesFile(data);
      }
      console.log(`Processed ${processedData.length} items for type ${type}`);

      const storageKey = type === "transactions" ? STORAGE_KEYS.transactions : STORAGE_KEYS.categories;
      const existingData = type === "transactions" ? getTransactionsData() : getCategoriesData();
      let mergedData;
      if (type === "transactions") {
        mergedData = mergeTransactionsData(processedData, existingData as any);
        await saveTransactionsData(mergedData, false);
      } else {
        mergedData = mergeCategoriesData(processedData, existingData as any);
        await saveCategoriesData(mergedData, false);
      }
      console.log(`Merged and saved; now ${mergedData.length} data rows in ${storageKey}`);

      onUploadComplete(file, processedData.slice(0, 5));

      cleanupSourceFile(fileInputRef.current);

    } catch (error) {
      console.error("Upload error:", error);
      toast({ title: t("common.error"), description: t("upload.error"), variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      // Enforce upload limits
      if (files.length > 10) {
        toast({
          title: t("common.error"),
          description: "No puedes subir más de 10 archivos a la vez.",
          variant: "destructive",
        });
        return;
      }
      const totalSize = files.reduce((acc, file) => acc + file.size, 0);
      if (totalSize > 50 * 1024 * 1024) {
        toast({
          title: t("common.error"),
          description: "El tamaño total de los archivos no puede superar los 50MB.",
          variant: "destructive",
        });
        return;
      }
      const filesToProcess = allowMultiple ? files : [files[0]];
      for (const file of filesToProcess) {
        if (!file) continue;
        const isExcel = file.name.endsWith('.xlsx');
        const isOds = file.name.endsWith('.ods');
        if (type === "transactions" && !isExcel) {
          toast({ title: t("common.error"), description: t("upload.transactionsExcelOnly"), variant: "destructive" });
          continue;
        }
        if (type === "categories" && !isExcel && !isOds) {
          toast({ title: t("common.error"), description: t("upload.invalidFormat"), variant: "destructive" });
          continue;
        }
        await handleUpload(file);
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
              <p className="text-xs text-gray-500 mb-1">
                Límite: 50MB o 10 archivos por subida.
              </p>
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
