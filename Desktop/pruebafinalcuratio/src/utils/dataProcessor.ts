import type { Transaction, Category } from './dataTypes';

// Clean number strings by removing € and converting , to .
const cleanNumber = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  return Number(value.replace('€', '').replace(',', '.').trim()) || 0;
};

// Parse Spanish date format
const parseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // If it's already in the expected format, return it
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  try {
    // For different date formats, try to standardize to dd/mm/yyyy
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  } catch {
    return '';
  }
};

/**
 * Process transactions file
 */
export const processTransactionsFile = (data: any[]): Transaction[] => {
  console.log("Processing transactions file with", data.length, "rows");
  if (data.length > 0) {
    console.log("Sample first raw row:", JSON.stringify(data[0]));
  }

  let lastKnownDate = '';
  
  return data.map((row, index) => {
    // Update the last known date if this row has a valid date
    if (row['Fecha']) {
      lastKnownDate = parseDate(row['Fecha']);
    }

    // Log raw 'Uni.' value for the first 5 rows of the uploaded file
    if (index < 5) {
      console.log(`[processTransactionsFile] Raw data from file for row ${index}: Uni.='${row['Uni.']}', typeof Uni.=${typeof row['Uni.']}`);
    }

    // Create the transaction using the last known date for empty dates
    const transaction = {
      fecha: row['Fecha'] ? parseDate(row['Fecha']) : lastKnownDate,
      hora: row['Hora'] || '',
      vendedor: row['Vendedor'] || '',
      codigo: row['Código'] || '',
      clienteDescripcion: row['Cliente / Descripción'] || '',
      tipo: row['Tipo'] || '',
      ta: row['TA'] || '',
      unidades: Number(row['Uni.'] || 0),
      precioAnterior: cleanNumber(row['P.Ant.']),
      pvp: cleanNumber(row['P.V.P.']),
      importeBruto: cleanNumber(row['Imp. Bruto']),
      descuento: cleanNumber(row['Dto.']),
      importeNeto: cleanNumber(row['Imp. Neto']),
      numeroDoc: row['Número Doc.'] || '',
      rp: row['R.P.'] || '',
      fact: row['Fact.'] || '',
      aCuenta: cleanNumber(row['A Cuenta']),
      entrega: cleanNumber(row['Entrega']),
      devolucion: cleanNumber(row['Devoluc.']),
      tipoPago: row['Tipo de Pago'] || ''
    };
    
    // Debug the first few transactions
    if (index < 3) {
      console.log(`Processed transaction ${index}:`, JSON.stringify(transaction));
    }
    
    return transaction;
  });
};

/**
 * Process categories file
 */
export const processCategoriesFile = (data: any[]): Category[] => {
  return data.map(row => ({
    codigo: (row['Código'] || '').toString(),
    descripcion: row['Descripción'] || '',
    familia: row['Familia'] || '',
    presentacion: row['Pres.'] || '',
    situacion: row['Situación'] || '',
    stockActual: Number(row['S.Actual'] || 0),
    stockMinimo: Number(row['S.Minimo'] || 0),
    stockMaximo: Number(row['S.Maximo'] || 0),
    pvp: cleanNumber(row['P.v.p.']),
    pmc: cleanNumber(row['P.m.c.']),
    puc: cleanNumber(row['P.u.c.']),
    valorPvp: cleanNumber(row['Valor a Pvp']),
    valorPmc: cleanNumber(row['Valor a Pmc']),
    valorPuc: cleanNumber(row['Valor a Puc']),
    margenPmc: Number(row['%Margen a Pmc'] || 0),
    margenPuc: Number(row['%Margen a Puc'] || 0),
    rotacion: Number(row['Rotación'] || 0),
    diasCobertura: Number(row['Dias de Cobertura'] || 0),
    unidadesVendidas: Number(row['Uds.Vendidas'] || 0),
    totalVenta: cleanNumber(row['Tot.Venta']),
    caducidad: row['Caducidad'] || '',
    ultimaEntrada: row['U.Entrada'] || '',
    ultimaSalida: row['U.Salida'] || '',
    grupoTerapeutico: row['G.Terap.'] || '',
    grupoTerapeuticoDesc: row['Grupo Terapeútico'] || '',
    codigoLaboratorio: row['C.Labor.'] || '',
    laboratorio: row['Laboratorio'] || ''
  }));
};
