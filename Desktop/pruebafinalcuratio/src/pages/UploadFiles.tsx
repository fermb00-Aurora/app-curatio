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

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    setPreviewData(null);
    setUploadedFiles([]);
  }, [fileType]);

  const handleFileUpload = async (file: File, filePreviewData: any[]) => {
    if (!fileType) {
      toast({
        title: t("common.error"),
        description: t("upload.selectTypeFirst"),
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      setPreviewData(filePreviewData);
      setUploadedFiles(prev => [...prev, { file, previewData: filePreviewData }]);
      
      refreshData();
      
      toast({
        title: t("common.success"),
        description: t("upload.fileProcessedSuccess"),
      });
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: t("common.error"),
        description: t("upload.fileProcessError"),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
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
              >
                <FileUpIcon className="h-4 w-4" />
                Insertar Datos
              </Button>
              <Button
                onClick={handleCancelUpload}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <XIcon className="h-4 w-4" />
                Cancelar subida
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default UploadFiles;
