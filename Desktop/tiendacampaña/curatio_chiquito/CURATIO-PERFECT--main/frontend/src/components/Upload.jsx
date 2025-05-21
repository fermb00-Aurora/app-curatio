import React, { useState, useRef } from 'react';
import Sidebar from './Sidebar';
import { supabase } from '../services/supabaseClient';

function Upload() {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [pendingFiles, setPendingFiles] = useState([]);
  const inputRef = useRef(null);

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
      setPendingFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files.length > 0) {
      setPendingFiles(prev => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const handleFiles = async (files) => {
    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setError('User not authenticated');
      setUploading(false);
      return;
    }

    let allSuccess = true;
    let errorMessages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `${user.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('userfiles')
        .upload(filePath, file);
      if (uploadError) {
        allSuccess = false;
        errorMessages.push(`${file.name}: ${uploadError.message}`);
      }
    }

    if (allSuccess) {
      setSuccessMessage('Todos los archivos se subieron correctamente');
      setPendingFiles([]);
    } else {
      setError('Algunos archivos no se subieron:\n' + errorMessages.join('\n'));
    }
    setUploading(false);
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
            multiple={true} 
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
            {uploading ? 'Seleccionar archivos...' : 'Seleccionar archivos'}
          </button>
          <ul className="mt-4 mb-4 text-left">
            {pendingFiles.map((file, idx) => (
              <li key={idx}>{file.name}</li>
            ))}
          </ul>
          <button
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            type="button"
            onClick={() => handleFiles(pendingFiles)}
            disabled={uploading || pendingFiles.length === 0}
          >
            {uploading ? 'Subiendo...' : 'Subir todos'}
          </button>
          <p className="mt-4 text-sm text-gray-500">Supported file types: .xlsx, .csv, .ods</p>
        </form>
      </div>
    </div>
  );
}

export default Upload; 