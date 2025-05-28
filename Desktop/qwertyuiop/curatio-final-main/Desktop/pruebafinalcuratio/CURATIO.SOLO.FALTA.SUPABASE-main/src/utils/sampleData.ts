
// Sample transaction data
export const sampleTransactions = [
  {
    fecha: "01/03/2025",
    hora: "9:06",
    vendedor: "(9)9 A LORENZO",
    codigo: "700698.5",
    cliente: "DUODAR 0,5 MG/A MG 30 CÁPSULAS",
    descripcion: "DUODAR 0,5 MG/A MG 30 CÁPSULAS",
    tipo: "Contado",
    unidades: 1,
    importeBruto: 19.38,
    descuento: 0.00,
    importeNeto: 19.38,
    numeroDoc: "B125219/2025",
    tipoPago: "Efectivo"
  },
  {
    fecha: "01/03/2025",
    hora: "9:06",
    vendedor: "(9)9 A LORENZO",
    codigo: "1367",
    cliente: "TORRES SANCHEZ JULIA",
    descripcion: "VARIOS PRODUCTOS",
    tipo: "Contado",
    unidades: 1,
    importeBruto: 0.00,
    descuento: 0.00,
    importeNeto: 0.00,
    numeroDoc: "C125219/2025",
    tipoPago: "Efectivo"
  },
  {
    fecha: "01/03/2025",
    hora: "9:06",
    vendedor: "(9)9 A LORENZO",
    codigo: "653343.7",
    cliente: "SIMVASTATINA KERN PHARMA EFG 20 MG 28 COMPRIMIDO",
    descripcion: "SIMVASTATINA KERN PHARMA EFG 20 MG 28 COMPRIMIDO",
    tipo: "Credito",
    unidades: 1,
    importeBruto: 1.52,
    descuento: 0.00,
    importeNeto: 1.52,
    numeroDoc: "",
    tipoPago: ""
  },
  {
    fecha: "01/03/2025",
    hora: "9:14",
    vendedor: "(9)9 A LORENZO",
    codigo: "7002",
    cliente: "TORRES ARTILES AMARANTO",
    descripcion: "VARIOS PRODUCTOS",
    tipo: "Credito",
    unidades: 0,
    importeBruto: 0.00,
    descuento: 0.00,
    importeNeto: 7.74,
    numeroDoc: "C125220/2025",
    tipoPago: "Efectivo"
  },
  {
    fecha: "01/03/2025",
    hora: "9:29",
    vendedor: "(9)9 A LORENZO",
    codigo: "688725.7",
    cliente: "DIOSMINA KERN PHARMA 500 MG 60 COMPRIMIDOS RECUB",
    descripcion: "DIOSMINA KERN PHARMA 500 MG 60 COMPRIMIDOS RECUB",
    tipo: "Contado",
    unidades: 1,
    importeBruto: 14.37,
    descuento: 0.00,
    importeNeto: 14.37,
    numeroDoc: "B131836/2025",
    tipoPago: "Tarjeta"
  },
  {
    fecha: "01/03/2025",
    hora: "9:30",
    vendedor: "(5)5 OVIDIO VIDAL",
    codigo: "174335.0",
    cliente: "DR SCHOLL GELACTIV PROFESIONAL HOMBRE T-L",
    descripcion: "DR SCHOLL GELACTIV PROFESIONAL HOMBRE T-L",
    tipo: "Contado",
    unidades: 1,
    importeBruto: 15.25,
    descuento: 0.00,
    importeNeto: 15.25,
    numeroDoc: "B131837/2025",
    tipoPago: "Tarjeta"
  },
  {
    fecha: "02/03/2025",
    hora: "9:47",
    vendedor: "(9)9 A LORENZO",
    codigo: "1804",
    cliente: "ESTEVEZ MARTIN PEPA",
    descripcion: "VARIOS PRODUCTOS",
    tipo: "Credito",
    unidades: 0,
    importeBruto: 0.00,
    descuento: 0.00,
    importeNeto: 12.60,
    numeroDoc: "C125221/2025",
    tipoPago: "Efectivo"
  },
  {
    fecha: "02/03/2025",
    hora: "9:53",
    vendedor: "(9)9 A LORENZO",
    codigo: "654283.5",
    cliente: "IXIA PLUS 20 MG/12,5 MG 28 COMPRIMIDOS RECUBIERT",
    descripcion: "IXIA PLUS 20 MG/12,5 MG 28 COMPRIMIDOS RECUBIERT",
    tipo: "Contado",
    unidades: 1,
    importeBruto: 5.71,
    descuento: 0.00,
    importeNeto: 5.71,
    numeroDoc: "B131837/2025",
    tipoPago: "Efectivo"
  }
];

// Sample categories data
export const sampleCategories = [
  {
    codigo: "000252",
    descripcion: "CHICLE ORBIT ORIGINAL",
    familia: "GOLOSINAS",
    situacion: "***",
    stock: 10,
    precio: 0.85,
    rotacion: 0,
    unidadesVendidas: 20
  },
  {
    codigo: "000283",
    descripcion: "CHICLE ORBIT MELON 10 GRAGEAS",
    familia: "GOLOSINAS",
    situacion: "***",
    stock: 5,
    precio: 0.85,
    rotacion: 0,
    unidadesVendidas: 15
  },
  {
    codigo: "000353",
    descripcion: "CHICLE ORBIT FRESA 10 GRAGEAS",
    familia: "GOLOSINAS",
    situacion: "***",
    stock: 8,
    precio: 0.85,
    rotacion: 0,
    unidadesVendidas: 22
  },
  {
    codigo: "000354",
    descripcion: "CHICLE ORBIT FRUTA",
    familia: "GOLOSINAS",
    situacion: "***",
    stock: 12,
    precio: 0.85,
    rotacion: 0,
    unidadesVendidas: 18
  },
  {
    codigo: "000355",
    descripcion: "CHICLE ORBIT MENTA 10 GRAGEAS",
    familia: "GOLOSINAS",
    situacion: "***",
    stock: 6,
    precio: 0.85,
    rotacion: 0,
    unidadesVendidas: 30
  },
  {
    codigo: "700698.5",
    descripcion: "DUODAR 0,5 MG/A MG 30 CÁPSULAS",
    familia: "MEDICAMENTOS",
    situacion: "***",
    stock: 15,
    precio: 19.38,
    rotacion: 0,
    unidadesVendidas: 5
  },
  {
    codigo: "653343.7",
    descripcion: "SIMVASTATINA KERN PHARMA EFG 20 MG 28 COMPRIMIDO",
    familia: "MEDICAMENTOS",
    situacion: "***",
    stock: 20,
    precio: 1.52,
    rotacion: 0,
    unidadesVendidas: 12
  },
  {
    codigo: "688725.7",
    descripcion: "DIOSMINA KERN PHARMA 500 MG 60 COMPRIMIDOS RECUB",
    familia: "MEDICAMENTOS",
    situacion: "***",
    stock: 8,
    precio: 14.37,
    rotacion: 0,
    unidadesVendidas: 6
  },
  {
    codigo: "174335.0",
    descripcion: "DR SCHOLL GELACTIV PROFESIONAL HOMBRE T-L",
    familia: "CUIDADO CORPORAL",
    situacion: "***",
    stock: 4,
    precio: 15.25,
    rotacion: 0,
    unidadesVendidas: 3
  },
  {
    codigo: "654283.5",
    descripcion: "IXIA PLUS 20 MG/12,5 MG 28 COMPRIMIDOS RECUBIERT",
    familia: "MEDICAMENTOS",
    situacion: "***",
    stock: 10,
    precio: 5.71,
    rotacion: 0,
    unidadesVendidas: 8
  }
];

// Function to initialize sample data in localStorage
export const initializeSampleData = () => {
  if (!localStorage.getItem("processed_transactions")) {
    localStorage.setItem("processed_transactions", JSON.stringify(sampleTransactions));
  }
  
  if (!localStorage.getItem("processed_categories")) {
    localStorage.setItem("processed_categories", JSON.stringify(sampleCategories));
  }
};
