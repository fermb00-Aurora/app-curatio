import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { readSpreadsheetFile } from '@/utils/fileConverter';
import { detectFileType } from '@/utils/dataDetector';
import { processTransactionsFile, processCategoriesFile } from '@/utils/dataProcessor';
import { useDataContext } from '@/contexts/DataContext';
import { uploadToSupabase } from '@/utils/supabaseStorage';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ChunkedUploaderProps {
  type: 'transactions' | 'categories';
  onUploadComplete: (file: File, previewData: any[]) => void;
  allowMultiple?: boolean;
}

export const ChunkedUploader: React.FC<ChunkedUploaderProps> = ({
  type,
  onUploadComplete,
  allowMultiple = false,
}) => {
  const { t } = useTranslation();
  const { refreshData } = useDataContext();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      for (const file of acceptedFiles) {
        const data = await readSpreadsheetFile(file);
        const detectedType = detectFileType(data);
        
        if (!detectedType || detectedType !== type) {
          toast({
            title: t('upload.invalidFileType'),
            description: t('upload.supportedFormats'),
            variant: 'destructive',
          });
          continue;
        }

        let processedData;
        if (type === 'transactions') {
          processedData = await processTransactionsFile(data);
        } else {
          processedData = await processCategoriesFile(data);
        }

        // Save processed data first
        const savedData = await saveProcessedData(type, processedData);
        if (!savedData) {
          throw new Error('Failed to save processed data');
        }

        // Then upload file to Supabase
        const result = await uploadToSupabase(file, type, (progress) => {
          setUploadProgress(progress);
        });

        if (!result.success) {
          toast({
            title: t('upload.error'),
            description: result.error,
            variant: 'destructive',
          });
          continue;
        }

        // Refresh data after successful upload and save
        await refreshData();
        
        onUploadComplete(file, savedData);
      }

      toast({
        title: t('upload.success'),
        description: t('upload.fileProcessed'),
      });
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: t('upload.error'),
        description: t('upload.tryAgain'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [type, onUploadComplete, refreshData, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: allowMultiple,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
    },
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>{t('upload.dropHere')}</p>
        ) : (
          <p>{t('upload.dragAndDrop')}</p>
        )}
      </div>
      
      {isUploading && (
        <div className="mt-4">
          <Progress value={uploadProgress} className="w-full" />
          <p className="text-sm text-muted-foreground mt-2">
            {t('upload.processing')} ({Math.round(uploadProgress)}%)
          </p>
        </div>
      )}
    </div>
  );
};
