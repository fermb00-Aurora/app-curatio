const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const XLSX = require('xlsx');
const Papa = require('papaparse');

const app = express();
const port = process.env.PORT || 3000;

// Supabase configuration
// Replace 'your-supabase-service-role-key' with your actual Supabase service role key
const supabaseUrl = 'https://wclfjdympbthafdpigxv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndjbGZqZHltcGJ0aGFmZHBpZ3h2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjAyNzQwMywiZXhwIjoyMDYxNjAzNDAzfQ.7_u2S5Pz4XkrvBUpLksGnNeBafrceKE2pRjoYm06w3M';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Ensure uploads directory exists
fs.mkdirSync('uploads', { recursive: true });

// API Endpoints
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    // Process file based on extension
    if (fileExtension === '.xlsx') {
      // Call processor.py script to process Excel file
      exec(`python processor.py "${filePath}"`, async (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing Python script: ${error}`);
          res.status(500).json({ error: 'Error processing Excel file' });
          return;
        }

        try {
          const salesData = JSON.parse(stdout);
          if (salesData.error) {
            throw new Error(salesData.error);
          }

          // Store in Supabase
          const { data, error } = await supabase
            .from('sales')
            .insert(salesData);

          if (error) throw error;
          res.status(200).json({ message: 'File processed and data stored successfully', data });
        } catch (err) {
          console.error(err);
          res.status(500).json({ error: 'Error processing or storing data: ' + err.message });
        } finally {
          // Clean up the uploaded file
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting file: ${err}`);
          });
        }
      });
    } else if (fileExtension === '.csv') {
      // Process CSV file for inventory data
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error(`Error reading CSV file: ${err}`);
          res.status(500).json({ error: 'Error reading CSV file' });
          fs.unlink(filePath, (err) => {
            if (err) console.error(`Error deleting file: ${err}`);
          });
          return;
        }

        Papa.parse(data, {
          header: true,
          complete: async (results) => {
            try {
              const inventoryData = results.data.map(row => ({
                'Código': row['Código'],
                'Descripción': row['Descripción'],
                'Familia': row['Familia'],
                'Pres': row['Pres.'],
                'Situación': row['Situación'],
                'S_Actual': parseInt(row['S.Actual']) || 0,
                'S_Minimo': parseInt(row['S.Minimo']) || 0,
                'S_Maximo': parseInt(row['S.Maximo']) || 0,
                'P_v_p': parseFloat(row['P.v.p.']) || 0.0,
                'P_m_c': parseFloat(row['P.m.c.']) || 0.0,
                'P_u_c': parseFloat(row['P.u.c.']) || 0.0,
                'Valor_a_Pvp': parseFloat(row['Valor a Pvp']) || 0.0,
                'Valor_a_Pmc': parseFloat(row['Valor a Pmc']) || 0.0,
                'Valor_a_Puc': parseFloat(row['Valor a Puc']) || 0.0,
                '%Margen_a_Pmc': parseFloat(row['%Margen a Pmc']) || 0.0,
                '%Margen_a_Puc': parseFloat(row['%Margen a Puc']) || 0.0,
                'Rotación': row['Rotación'],
                'Dias_de_Cobertura': parseInt(row['Dias de Cobertura']) || 0,
                'Uds_Vendidas': parseInt(row['Uds.Vendidas']) || 0,
                'Tot_Venta': parseFloat(row['Tot.Venta']) || 0.0,
                'Caducidad': row['Caducidad'],
                'U_Entrada': parseInt(row['U.Entrada']) || 0,
                'U_Salida': parseInt(row['U.Salida']) || 0,
                'G_Terap': row['G.Terap.'],
                'Grupo_Terapeútico': row['Grupo Terapeútico'],
                'C_Labor': row['C.Labor.'],
                'Laboratorio': row['Laboratorio']
              }));

              // Store in Supabase
              const { data, error } = await supabase
                .from('inventory')
                .insert(inventoryData);

              if (error) throw error;
              res.status(200).json({ message: 'CSV file processed and data stored successfully', data });
            } catch (err) {
              console.error(err);
              res.status(500).json({ error: 'Error processing or storing CSV data: ' + err.message });
            } finally {
              fs.unlink(filePath, (err) => {
                if (err) console.error(`Error deleting file: ${err}`);
              });
            }
          },
          error: (error) => {
            console.error(`Error parsing CSV: ${error}`);
            res.status(500).json({ error: 'Error parsing CSV file' });
            fs.unlink(filePath, (err) => {
              if (err) console.error(`Error deleting file: ${err}`);
            });
          }
        });
      });
    } else if (fileExtension === '.ods') {
      // Process ODS file for inventory data
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const inventoryData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Assuming first row is headers
      const headers = inventoryData[0];
      const rows = inventoryData.slice(1);

      try {
        const processedData = rows.map(row => {
          const rowData = {};
          headers.forEach((header, index) => {
            let key = header;
            if (key === 'Pres.') key = 'Pres';
            if (key === 'S.Actual') key = 'S_Actual';
            if (key === 'S.Minimo') key = 'S_Minimo';
            if (key === 'S.Maximo') key = 'S_Maximo';
            if (key === 'P.v.p.') key = 'P_v_p';
            if (key === 'P.m.c.') key = 'P_m_c';
            if (key === 'P.u.c.') key = 'P_u_c';
            if (key === 'Valor a Pvp') key = 'Valor_a_Pvp';
            if (key === 'Valor a Pmc') key = 'Valor_a_Pmc';
            if (key === 'Valor a Puc') key = 'Valor_a_Puc';
            if (key === '%Margen a Pmc') key = '%Margen_a_Pmc';
            if (key === '%Margen a Puc') key = '%Margen_a_Puc';
            if (key === 'Dias de Cobertura') key = 'Dias_de_Cobertura';
            if (key === 'Uds.Vendidas') key = 'Uds_Vendidas';
            if (key === 'Tot.Venta') key = 'Tot_Venta';
            if (key === 'U.Entrada') key = 'U_Entrada';
            if (key === 'U.Salida') key = 'U_Salida';
            if (key === 'G.Terap.') key = 'G_Terap';
            if (key === 'Grupo Terapeútico') key = 'Grupo_Terapeútico';
            if (key === 'C.Labor.') key = 'C_Labor';
            rowData[key] = row[index];
          });
          return rowData;
        });

        // Store in Supabase
        const { data, error } = await supabase
          .from('inventory')
          .insert(processedData);

        if (error) throw error;
        res.status(200).json({ message: 'ODS file processed and data stored successfully', data });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error processing or storing ODS data: ' + err.message });
      } finally {
        fs.unlink(filePath, (err) => {
          if (err) console.error(`Error deleting file: ${err}`);
        });
      }
    } else {
      // Clean up the uploaded file if unsupported
      fs.unlink(filePath, (err) => {
        if (err) console.error(`Error deleting file: ${err}`);
      });
      res.status(400).json({ error: 'Unsupported file type' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error processing file' });
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