import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { ChevronLeftIcon, FileUpIcon, XIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ChunkedUploader } from "@/components/upload/ChunkedUploader";
import { useDataContext } from "@/contexts/DataContext";
import { 
  saveTransactionsData, 
  saveCategoriesData, 
  getTransactionsData, 
  getCategoriesData, 
  mergeTransactionsData, 
  mergeCategoriesData 
} from "@/utils/dataStorage";
import { clearAllData } from "@/utils/storage/baseStorage";
import { readSpreadsheetFile } from "@/utils/fileConverter";
import { processTransactionsFile, processCategoriesFile } from "@/utils/dataProcessor";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import * as XLSX from 'xlsx';
import { supabase } from '@/services/supabaseClient';
import { Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

interface UploadedFile {
  file: File;
  previewData: any[];
}

const UploadFiles = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refreshData } = useDataContext();
  const [fileType, setFileType] = useState<"transactions" | "categories" | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [pendingInsertData, setPendingInsertData] = useState<any[]>([]);
  const [pendingFileType, setPendingFileType] = useState<null | 'transactions' | 'categories'>(null);
  const [progress, setProgress] = useState(0);
  const BATCH_SIZE = 500;

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    setPreviewData(null);
    setUploadedFiles([]);
  }, [fileType]);

  const parseFile = async (file: File) => {
    return new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(json);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });
  };

  const checkDuplicates = async (data: any[], type: 'transactions' | 'categories') => {
    let existing = [];
    if (type === 'transactions') {
      const { data: existingData } = await supabase.from('transactions').select('codigo');
      existing = existingData?.map((row: any) => row.codigo) || [];
      return data.some(row => existing.includes(row.codigo));
    } else {
      const { data: existingData } = await supabase.from('categories').select('codigo');
      existing = existingData?.map((row: any) => row.codigo) || [];
      return data.some(row => existing.includes(row.codigo));
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!fileType) {
      toast({ title: t("common.error"), description: t("upload.selectTypeFirst"), variant: "destructive" });
      return;
    }
    setIsUploading(true);
    setProgress(10);
    try {
      const parsedData = await parseFile(file);
      setProgress(40);
      // Only show top 10 rows in preview
      setPreviewData(parsedData.slice(0, 10));
      setUploadedFiles([{ file, previewData: parsedData.slice(0, 10) }]);
      // Check for duplicates
      const hasDuplicates = await checkDuplicates(parsedData, fileType);
      setProgress(60);
      if (hasDuplicates) {
        setPendingInsertData(parsedData);
        setPendingFileType(fileType);
        setShowDuplicateModal(true);
        setIsUploading(false);
        return;
      } else {
        await insertData(parsedData, fileType);
      }
      setProgress(100);
      toast({ title: t("common.success"), description: t("upload.fileProcessedSuccess") });
      refreshData();
    } catch (error) {
      console.error("Error processing file:", error);
      toast({ title: t("common.error"), description: t("upload.fileProcessError"), variant: "destructive" });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  const batchUpsert = async (data: any[], type: 'transactions' | 'categories') => {
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      if (type === 'transactions') {
        await supabase.from('transactions').upsert(batch, { onConflict: 'codigo' });
      } else {
        await supabase.from('categories').upsert(batch, { onConflict: 'codigo' });
      }
      setProgress(80 + Math.round((i / data.length) * 20));
    }
  };

  const insertData = async (data: any[], type: 'transactions' | 'categories') => {
    setIsUploading(true);
    setProgress(80);
    await batchUpsert(data, type);
    setProgress(100);
    setIsUploading(false);
    setShowDuplicateModal(false);
    setPendingInsertData([]);
    setPendingFileType(null);
    toast({ title: t("common.success"), description: t("upload.fileProcessedSuccess") });
    refreshData();
  };

  const handleInsertData = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: t("common.error"),
        description: t("upload.noFilesUploadedYet"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("common.success"),
      description: "Datos procesados y guardados.",
    });

    setPreviewData(null);
    setUploadedFiles([]);
        
    navigate(fileType === "transactions" ? "/transactions" : "/products");
  };

  const handleClearAllData = async () => {
    setIsUploading(true);
    await clearAllData();
    setIsUploading(false);
    setPreviewData(null);
    setUploadedFiles([]);
    toast({ title: t('common.success'), description: t('upload.allDataCleared') });
    refreshData();
  };

  const handleCancelUpload = () => {
    setPreviewData(null);
    setUploadedFiles([]);
    
    toast({
      title: t("common.info"),
      description: t("upload.uploadCancelled"),
    });
  };

  const renderTransactionsPreview = (data: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("transactions.date")}</TableHead>
          <TableHead>{t("transactions.time")}</TableHead>
          <TableHead>{t("transactions.seller")}</TableHead>
          <TableHead>{t("transactions.code")}</TableHead>
          <TableHead>{t("transactions.clientDescription")}</TableHead>
          <TableHead>{t("transactions.type")}</TableHead>
          <TableHead>{t("transactions.units")}</TableHead>
          <TableHead>{t("transactions.pvp")}</TableHead>
          <TableHead>{t("transactions.grossAmount")}</TableHead>
          <TableHead>{t("transactions.discount")}</TableHead>
          <TableHead>{t("transactions.netAmount")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={index}>
            <TableCell>{item.fecha}</TableCell>
            <TableCell>{item.hora}</TableCell>
            <TableCell>{item.vendedor}</TableCell>
            <TableCell>{item.codigo}</TableCell>
            <TableCell>{item.clienteDescripcion}</TableCell>
            <TableCell>{item.tipo}</TableCell>
            <TableCell>{item.unidades}</TableCell>
            <TableCell>{item.pvp}</TableCell>
            <TableCell>{item.importeBruto}</TableCell>
            <TableCell>{item.descuento}</TableCell>
            <TableCell>{item.importeNeto}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderCategoriesPreview = (data: any[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Código</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Familia</TableHead>
          <TableHead>Pres.</TableHead>
          <TableHead>Situación</TableHead>
          <TableHead>S.Actual</TableHead>
          <TableHead>S.Minimo</TableHead>
          <TableHead>S.Maximo</TableHead>
          <TableHead>P.v.p.</TableHead>
          <TableHead>P.m.c.</TableHead>
          <TableHead>P.u.c.</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => (
          <TableRow key={item.codigo || index}>
            <TableCell>{item.codigo}</TableCell>
            <TableCell>{item.descripcion}</TableCell>
            <TableCell>{item.familia}</TableCell>
            <TableCell>{item.presentacion}</TableCell>
            <TableCell>{item.situacion}</TableCell>
            <TableCell>{item.stockActual}</TableCell>
            <TableCell>{item.stockMinimo}</TableCell>
            <TableCell>{item.stockMaximo}</TableCell>
            <TableCell>{item.pvp}</TableCell>
            <TableCell>{item.pmc}</TableCell>
            <TableCell>{item.puc}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <MainLayout
      title={t("upload.title")}
      showDateFilter={false}
      rightHeaderContent={
        <Link
          to="/"
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <ChevronLeftIcon className="h-5 w-5 mr-1" />
          {t("upload.backToDashboard")}
        </Link>
      }
    >
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("upload.fileType")}
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={fileType === "transactions"}
                  onChange={() => setFileType("transactions")}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t("upload.transactions")}
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={fileType === "categories"}
                  onChange={() => setFileType("categories")}
                />
                <span className="ml-2 text-sm text-gray-700">
                  {t("upload.categories")}
                </span>
              </label>
            </div>
          </div>
          
          <div className="mb-6">
            {fileType && (
              <ChunkedUploader 
                type={fileType} 
                allowMultiple={true}
                onUploadComplete={handleFileUpload} 
              />
            )}
            {!fileType && (
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <p className="text-gray-500">{t("upload.selectTypeFirst")}</p>
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">{t("upload.uploadedFiles")}</h3>
              <div className="space-y-2">
                {uploadedFiles.map((uploadedFile, index) => (
                  <div key={index} className="flex items-center">
                    <FileUpIcon className="h-5 w-5 mr-2 text-blue-500" />
                    <span className="text-sm font-medium">{uploadedFile.file.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {previewData && previewData.length > 0 && (
            <div className="mt-6 mb-6">
              <h3 className="text-lg font-medium mb-3">Vista previa de datos</h3>
              <div className="border rounded-md">
                <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                  <div style={{ minWidth: '1500px', paddingBottom: '10px' }}>
                    {fileType === "categories" 
                      ? renderCategoriesPreview(previewData)
                      : renderTransactionsPreview(previewData)}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {uploadedFiles.length > 0 && (
            <div className="mt-6 flex justify-end space-x-4">
              <Button
                onClick={handleInsertData}
                className="flex items-center gap-2"
                disabled={isUploading}
              >
                <FileUpIcon className="h-4 w-4" />
                Insertar Datos
              </Button>
              <Button
                onClick={handleClearAllData}
                variant="destructive"
                className="flex items-center gap-2"
                disabled={isUploading}
              >
                <XIcon className="h-4 w-4" />
                Borrar todos los datos
              </Button>
            </div>
          )}
        </div>
      </div>
      <Dialog open={showDuplicateModal} onClose={() => setShowDuplicateModal(false)}>
        <DialogTitle>{t('upload.duplicateTitle') || 'Duplicados encontrados'}</DialogTitle>
        <DialogContent>{t('upload.duplicateDescription') || 'Se han encontrado datos duplicados. ¿Deseas sobrescribir los datos existentes con la nueva información?'}</DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDuplicateModal(false)}>{t('common.cancel') || 'Cancelar'}</Button>
          <Button onClick={async () => { await insertData(pendingInsertData, pendingFileType!); }}>{t('common.overwrite') || 'Sobrescribir'}</Button>
        </DialogActions>
      </Dialog>
      {isUploading && (
        <div style={{ width: '100%', margin: '10px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CircularProgress size={24} />
          <div style={{ width: '100%' }}>
            <div style={{ width: `${progress}%`, height: '8px', background: '#3b82f6', borderRadius: '4px', transition: 'width 0.3s' }} />
            <div style={{ fontSize: '12px', color: '#666' }}>{`Procesando... (${progress}%)`}</div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default UploadFiles;
