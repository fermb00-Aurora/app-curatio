import React, { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { readSpreadsheetFile, cleanupSourceFile } from "@/utils/fileConverter";
import { detectFileType } from "@/utils/dataDetector";
import { processTransactionsFile, processCategoriesFile } from "@/utils/dataProcessor";
import { useDataContext } from "@/contexts/DataContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '../../../frontend/src/services/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
  const [duplicateRows, setDuplicateRows] = useState<any[]>([]);
  const [rowsToUpsert, setRowsToUpsert] = useState<any[]>([]);
  const [modalIndex, setModalIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

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

  // Helper to check for duplicates in Supabase
  const checkDuplicates = async (rows: any[], userId: string) => {
    const uniqueKey = type === 'transactions' ? 'numero_doc' : 'codigo';
    const keys = rows.map(row => row[uniqueKey]);
    const { data, error } = await supabase
      .from(type)
      .select(uniqueKey)
      .in(uniqueKey, keys)
      .eq('user_id', userId);
    if (error) throw error;
    return data?.map((d: any) => d[uniqueKey]) || [];
  };

  // Upsert rows to Supabase
  const upsertRows = async (rows: any[], userId: string) => {
    const rowsWithUser = rows.map(row => ({ ...row, user_id: userId }));
    const { error } = await supabase
      .from(type)
      .upsert(rowsWithUser, { onConflict: type === 'transactions' ? 'user_id,numero_doc' : 'user_id,codigo' });
    if (error) {
      console.error('Supabase upsert error:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  // Handle preview confirmation
  const handleConfirmUpload = async () => {
    if (!selectedFile || !user) return;
    setConfirming(true);
    setUploading(true);
    try {
      const allRows = await parseFile(selectedFile);
      // Validate all rows (simple required field check)
      const requiredKey = type === 'transactions' ? 'numero_doc' : 'codigo';
      if (allRows.some(row => !row[requiredKey])) {
        toast({ title: t('common.error'), description: `Faltan campos requeridos (${requiredKey}) en el archivo.`, variant: 'destructive' });
        setConfirming(false); setUploading(false); return;
      }
      // Check for duplicates
      const duplicates = await checkDuplicates(allRows, user.id);
      if (duplicates.length > 0) {
        setDuplicateRows(allRows.filter(row => duplicates.includes(row[requiredKey])));
        setRowsToUpsert(allRows.filter(row => !duplicates.includes(row[requiredKey])));
        setModalIndex(0);
      } else {
        setRowsToUpsert(allRows);
        await upsertRows(allRows, user.id);
        toast({ title: 'Éxito', description: 'Datos subidos correctamente.', variant: 'default' });
        setShowPreview(false); setSelectedFile(null); setPreviewData([]);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Error', description: error.message || 'Error al subir los datos.', variant: 'destructive' });
    } finally {
      setConfirming(false); setUploading(false);
    }
  };

  // Handle modal actions
  const handleModalAction = async (action: 'replace' | 'skip') => {
    const row = duplicateRows[modalIndex];
    if (action === 'replace') {
      setRowsToUpsert(prev => [...prev, row]);
    }
    if (modalIndex + 1 < duplicateRows.length) {
      setModalIndex(modalIndex + 1);
    } else {
      // All modals done, upsert
      setUploading(true);
      try {
        await upsertRows(rowsToUpsert.concat(action === 'replace' ? [row] : []), user!.id);
        setDuplicateRows([]); setRowsToUpsert([]); setModalIndex(0);
        setShowPreview(false); setSelectedFile(null); setPreviewData([]);
        toast({ title: 'Éxito', description: 'Datos subidos correctamente.', variant: 'default' });
      } catch (error: any) {
        console.error('Upsert error:', error);
        toast({ title: 'Error', description: error.message || 'Error al subir los datos.', variant: 'destructive' });
      } finally {
        setUploading(false);
      }
    }
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

  if (duplicateRows.length > 0 && modalIndex < duplicateRows.length) {
    const row = duplicateRows[modalIndex];
    return (
      <Dialog open={true}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fila duplicada detectada</DialogTitle>
            <DialogDescription>
              Revisa la fila detectada como duplicada y elige si deseas reemplazarla o saltarla.
            </DialogDescription>
          </DialogHeader>
          <pre className="bg-gray-100 p-2 rounded text-xs mb-2">{JSON.stringify(row, null, 2)}</pre>
          <DialogFooter>
            <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => handleModalAction('replace')}>Reemplazar</button>
            <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => handleModalAction('skip')}>Saltar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
