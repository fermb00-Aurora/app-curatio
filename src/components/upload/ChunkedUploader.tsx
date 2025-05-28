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
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);

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

  const parseFile = async (file: File) => {
    if (file.name.endsWith('.csv')) {
      return new Promise<any[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          complete: (results) => resolve(results.data),
          error: reject,
        });
      });
    } else {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet);
    }
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    const data = await parseFile(file);
    setPreviewData(data.slice(0, 10));
    setShowPreview(true);
    setConfirming(false);
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile || !user) return;
    setConfirming(true);
    await handleUpload(selectedFile);
    setShowPreview(false);
    setSelectedFile(null);
    setPreviewData([]);
    setConfirming(false);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
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
      // Only allow one file at a time for preview/confirmation
      await handleFileSelect(files[0]);
    },
    disabled: isUploading,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
      'text/csv': ['.csv'],
    },
  });

  if (showPreview && selectedFile) {
    return (
      <div className="space-y-4">
        <div className="border rounded p-4 bg-white">
          <h3 className="font-semibold mb-2">Vista previa de los datos</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  {Object.keys(previewData[0] || {}).map((key) => (
                    <th key={key} className="px-2 py-1 border-b">{key}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i}>
                    {Object.values(row).map((val, j) => (
                      <td key={j} className="px-2 py-1 border-b">{String(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleConfirmUpload}
              disabled={confirming}
            >
              {confirming ? 'Subiendo...' : 'Confirmar y subir'}
            </button>
            <button
              className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => { setShowPreview(false); setSelectedFile(null); setPreviewData([]); }}
              disabled={confirming}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

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
