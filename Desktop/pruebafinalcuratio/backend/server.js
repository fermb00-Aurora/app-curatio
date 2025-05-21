const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const XLSX = require('xlsx');
const Papa = require('papaparse');

const app = express();
const port = process.env.PORT || 3000;

// Supabase configuration (now using env variables)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Use memory storage for multer
const upload = multer({ storage: multer.memoryStorage() });

// Ensure uploads directory exists
fs.mkdirSync('uploads', { recursive: true });

// API Endpoints
app.post('/upload', upload.array('files'), async (req, res) => {
  try {
    // 1. Extract JWT from Authorization header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    // 2. Decode JWT to get user_id (sub)
    let userId;
    try {
      const decoded = jwt.decode(token);
      userId = decoded.sub;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const results = [];
    for (const file of req.files) {
      // 3. Store file in user-specific folder
      const { data: storageData, error: storageError } = await supabase.storage
        .from('uploads')
        .upload(`user-uploads/${userId}/${Date.now()}-${file.originalname}`, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
      if (storageError) throw storageError;

      // 4. Determine file type
      let fileType = null;
      if (file.originalname.toLowerCase().includes('venta')) fileType = 'ventas';
      else if (file.originalname.toLowerCase().includes('catalogo')) fileType = 'catalogo';
      else fileType = 'unknown';

      // 5. Parse/process file (placeholder)
      let processedData = [];
      // You can add your actual processing logic here

      // 6. Insert into uploaded_files with user_id
      const { data: uploadedFile, error: uploadFileError } = await supabase
        .from('uploaded_files')
        .insert([{
          user_id: userId,
          file_type: fileType,
          storage_path: storageData.path,
          processed_data: processedData,
        }])
        .select()
        .single();
      if (uploadFileError) throw uploadFileError;

      results.push({
        filename: file.originalname,
        storagePath: storageData.path,
        fileType,
        processedCount: processedData.length,
      });
    }
    res.json({ success: true, files: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/sales', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sales')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching sales data' });
  }
});

app.get('/inventory', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inventory')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching inventory data' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 