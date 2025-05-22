import * as XLSX from 'xlsx';
import { format, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabaseClient';

// Types for processed data
export interface Transaction {
  fecha: string;
  hora: string;
  vendedor: string;
  codigo: string;
  clienteDescripcion: string;
  tipo: string;
  ta: string;
  unidades: number;
  precioAnterior: number;
  pvp: number;
  importeBruto: number;
  descuento: number;
  importeNeto: number;
  numeroDoc: string;
  rp: string;
  fact: string;
  aCuenta: number;
  entrega: number;
  devolucion: number;
  tipoPago: string;
}

export interface Category {
  codigo: string;
  descripcion: string;
  familia: string;
  presentacion: string;
  situacion: string;
  stockActual: number;
  stockMinimo: number;
  stockMaximo: number;
  pvp: number;
  pmc: number;
  puc: number;
  valorPvp: number;
  valorPmc: number;
  valorPuc: number;
  margenPmc: number;
  margenPuc: number;
  rotacion: number;
  diasCobertura: number;
  unidadesVendidas: number;
  totalVenta: number;
  caducidad: string;
  ultimaEntrada: string;
  ultimaSalida: string;
  grupoTerapeutico: string;
  grupoTerapeuticoDesc: string;
  codigoLaboratorio: string;
  laboratorio: string;
}

// Clean number strings by removing € and converting , to .
const cleanNumber = (value: string): number => {
  if (!value || typeof value !== 'string') return 0;
  return Number(value.replace('€', '').replace(',', '.').trim()) || 0;
};

// Parse Spanish date format
const parseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = parse(dateStr, 'dd/MM/yyyy', new Date());
    return format(date, 'yyyy-MM-dd');
  } catch {
    return '';
  }
};

// Detect file type based on structure
export const detectFileType = (data: any[]): 'transactions' | 'categories' | null => {
  if (!data || !data[0]) return null;
  
  // Check for transaction file indicators
  if (
    data[0].hasOwnProperty('Fecha') ||
    data[0].hasOwnProperty('Vendedor') ||
    data[0].hasOwnProperty('Tipo de Pago')
  ) {
    return 'transactions';
  }
  
  // Check for categories file indicators
  if (
    data[0].hasOwnProperty('Código') ||
    data[0].hasOwnProperty('Familia') ||
    data[0].hasOwnProperty('Descripción')
  ) {
    return 'categories';
  }
  
  return null;
};

// Function to read Excel and ODS files
export const readSpreadsheetFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        resolve(json);
      } catch (error) {
        console.error("Error parsing file:", error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

// Process transactions file
export const processTransactionsFile = (data: any[]): Transaction[] => {
  return data.map(row => ({
    fecha: parseDate(row['Fecha'] || ''),
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
  }));
};

// Process categories file
export const processCategoriesFile = (data: any[]): Category[] => {
  return data.map(row => ({
    codigo: row['Código'] || '',
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

// Save processed data to Supabase with proper naming
export const saveProcessedData = async (type: 'transactions' | 'categories', data: any[]) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return data;
    }

    const { error } = await supabase
      .from(type)
      .upsert(
        data.map(item => ({
          ...item,
          user_id: user.id
        }))
      );

    if (error) {
      console.error(`Error saving ${type}:`, error);
    }

    return data;
  } catch (error) {
    console.error(`Error in saveProcessedData for ${type}:`, error);
    return data;
  }
};

// Get saved data from Supabase
export const getProcessedData = async (type: 'transactions' | 'categories') => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("User not authenticated");
      return [];
    }

    const { data } = await supabase
      .from(type)
      .select()
      .eq('user_id', user.id);

    return data || [];
  } catch (error) {
    console.error(`Error in getProcessedData for ${type}:`, error);
    return [];
  }
};

// Filter data by date range
export const filterDataByDateRange = (data: any[], startDate: Date, endDate: Date) => {
  if (!data || !data.length) return [];
  
  return data.filter(item => {
    if (!item.fecha) return false;
    
    // Parse the date from the Spanish format dd/mm/yyyy
    const parts = item.fecha.split('/');
    if (parts.length !== 3) return false;
    
    // Create date - month is 0-indexed in JavaScript Date
    const itemDate = new Date(
      parseInt(parts[2]), // year
      parseInt(parts[1]) - 1, // month (0-indexed)
      parseInt(parts[0]) // day
    );
    
    return itemDate >= startDate && itemDate <= endDate;
  });
};
