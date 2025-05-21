/**
 * Transaction data type definition
 */
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

/**
 * Category/Product data type definition
 */
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

/**
 * Data store type definitions
 */
export interface DataStore {
  transactions: Transaction[];
  categories: Category[];
  availableDates: Date[];
  uniqueCategories: string[];
  lastUpdated: {
    transactions: string | null;
    categories: string | null;
  };
}
