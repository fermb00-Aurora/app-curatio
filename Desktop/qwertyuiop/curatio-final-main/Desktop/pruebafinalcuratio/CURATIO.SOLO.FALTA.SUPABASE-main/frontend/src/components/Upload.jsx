import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import { supabase } from '../services/supabaseClient';
import * as XLSX from 'xlsx';

function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const inputRef = useRef(null);
  const MAX_FILES = 10;
  const MAX_SIZE_MB = 50;

  // Definición de columnas para validación de tipo
  const TRANSACTION_COLUMNS = [
    'fecha', 'hora', 'vendedor', 'codigo', 'clienteDescripcion', 'tipo', 'ta', 'unidades', 'precioAnterior', 'pvp', 'importeBruto', 'descuento', 'importeNeto', 'numeroDoc', 'rp', 'fact', 'aCuenta', 'entrega', 'devolucion', 'tipoPago'
  ];
  const CATEGORY_COLUMNS = [
    'codigo', 'descripcion', 'familia', 'presentacion', 'situacion', 'stockActual', 'stockMinimo', 'stockMaximo', 'pvp', 'pmc', 'puc', 'valorPvp', 'valorPmc', 'valorPuc', 'margenPmc', 'margenPuc', 'rotacion', 'diasCobertura', 'unidadesVendidas', 'totalVenta', 'caducidad', 'ultimaEntrada', 'ultimaSalida', 'grupoTerapeutico', 'grupoTerapeuticoDesc', 'codigoLaboratorio', 'laboratorio'
  ];

  const [fileType, setFileType] = useState('transactions'); // 'transactions' o 'categories'

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  // Utilidad para leer y validar el archivo Excel/ODS
  const validateFileType = async (file, type) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet);
          if (!jsonData[0]) {
            reject('El archivo está vacío o no tiene datos.');
            return;
          }
          const columns = Object.keys(jsonData[0]);
          if (type === 'transactions') {
            const missing = TRANSACTION_COLUMNS.filter(col => !columns.includes(col));
            if (missing.length > 0) {
              reject('El archivo no es un archivo de ventas válido. Faltan columnas: ' + missing.join(', '));
              return;
            }
          } else if (type === 'categories') {
            const missing = CATEGORY_COLUMNS.filter(col => !columns.includes(col));
            if (missing.length > 0) {
              reject('El archivo no es un catálogo de productos válido. Faltan columnas: ' + missing.join(', '));
              return;
            }
          }
          resolve();
        } catch (err) {
          reject('No se pudo leer el archivo. Asegúrate de que sea un archivo Excel/ODS válido.');
        }
      };
      reader.onerror = () => reject('Error al leer el archivo.');
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFiles = async (files) => {
    if (files.length > MAX_FILES) {
      setError(`No se permite subir más de ${MAX_FILES} archivos a la vez.`);
      return;
    }
    const file = files[0];
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`El archivo excede el tamaño máximo permitido (${MAX_SIZE_MB}MB).`);
      return;
    }
    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    // Validar tipo de archivo según selección
    try {
      await validateFileType(file, fileType);
    } catch (validationError) {
      setError(validationError);
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    // Obtener el user_id autenticado
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData || !userData.user) {
      setError('No se pudo obtener el usuario autenticado.');
      setUploading(false);
      return;
    }
    formData.append('user_id', userData.user.id);

    try {
      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setSuccessMessage(result.message || 'File uploaded and processed successfully');
    } catch (err) {
      setError(err.message || 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 p-10">
        <h1 className="text-3xl font-bold mb-6">Upload Files</h1>
        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert"><span className="block sm:inline">{error}</span></div>}
        {successMessage && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert"><span className="block sm:inline">{successMessage}</span></div>}
        <form 
          className={`border-2 border-dashed p-8 text-center ${dragActive ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-gray-200'}`} 
          onDragEnter={handleDrag} 
          onDragOver={handleDrag} 
          onDragLeave={handleDrag} 
          onDrop={handleDrop}
          onSubmit={(e) => e.preventDefault()}
        >
          <input 
            ref={inputRef} 
            type="file" 
            className="hidden" 
            multiple={false} 
            onChange={handleChange} 
            accept=".xlsx,.csv,.ods" 
          />
          <p className="mb-4 text-lg">Drag and drop your files here or</p>
          <button 
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" 
            type="button" 
            onClick={onButtonClick}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload a file'}
          </button>
          <p className="mt-4 text-sm text-gray-500">Supported file types: .xlsx, .csv, .ods</p>
          <p className="mt-2 text-sm text-gray-500">Tamaño máximo por archivo: {MAX_SIZE_MB}MB. Máximo {MAX_FILES} archivos por subida. El archivo debe corresponder al tipo seleccionado arriba.</p>
        </form>
      </div>
    </div>
  );
}

export default Upload; 