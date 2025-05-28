import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FileUpIcon, ChevronLeft, ChevronRight } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useDataContext } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGenericTable } from "@/hooks/useTransactionTable";
import { supabase } from '../../frontend/src/services/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const Products = () => {
  const { t } = useTranslation();
  const { dataStore, refreshData } = useDataContext();
  const [categories, setCategories] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    category: "all",
    description: "",
    code: "",
  });
  const [sortConfig, setSortConfig] = useState({
    key: "totalVenta",
    direction: "desc"
  });
  const itemsPerPage = 10;
  const [allProducts, setAllProducts] = useState<any[]>([]);
  
  const {
    paginatedItems: paginatedProducts,
    currentPage,
    setCurrentPage,
    totalPages,
  } = useGenericTable({
    items: allProducts,
    itemsPerPage,
  });

  const { user } = useAuth();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    refreshData();
    const uniqueCategories = dataStore.uniqueCategories || [];
    setCategories(uniqueCategories);
    applyFilters(dataStore.categories, filters);
  }, [dataStore.categories, dataStore.uniqueCategories]);

  const applyFilters = (products: any[], currentFilters: typeof filters) => {
    let result = [...products];
    
    if (currentFilters.category !== "all") {
      result = result.filter((p) => p.familia === currentFilters.category);
    }
    
    if (currentFilters.description) {
      const searchLower = currentFilters.description.toLowerCase();
      result = result.filter((p) =>
        p.descripcion?.toLowerCase().includes(searchLower)
      );
    }
    
    if (currentFilters.code) {
      const codeLower = currentFilters.code.toLowerCase();
      result = result.filter((p) =>
        p.codigo?.toLowerCase().includes(codeLower)
      );
    }
    
    // Apply sorting
    result = sortData(result, sortConfig.key, sortConfig.direction);
    
    setAllProducts(result);
  };

  const sortData = (data: any[], key: string, direction: string) => {
    return [...data].sort((a, b) => {
      const valueA = a[key] === undefined ? 0 : a[key];
      const valueB = b[key] === undefined ? 0 : b[key];
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return direction === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // For string values
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleSort = (key: string) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
    setSortConfig({ key, direction });
    applyFilters(dataStore.categories, filters);
  };

  const handleFilterChange = (name: string, value: string) => {
    const newFilters = {
      ...filters,
      [name]: value,
    };
    setFilters(newFilters);
    applyFilters(dataStore.categories, newFilters);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "€0.00";
    return value.toLocaleString("es-ES", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatPercent = (value: number | undefined) => {
    if (value === undefined) return "0.00%";
    return (value / 100).toLocaleString("es-ES", {
      style: "percent",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const EmptyState = () => (
    <div className="text-center py-12 px-4 bg-white rounded-lg shadow-md">
      <FileUpIcon className="mx-auto h-16 w-16 text-blue-500 mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        No hay productos
      </h3>
      <p className="text-sm text-gray-600 mb-6">
        Sube un archivo de categorías para comenzar a gestionar tus productos
      </p>
      <Link to="/upload" className="inline-block">
        <Button className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 transition-colors">
          <FileUpIcon className="h-5 w-5" />
          Subir archivo de categorías
        </Button>
      </Link>
    </div>
  );

  const getButtonStyle = (key: string) => {
    return sortConfig.key === key 
      ? "bg-blue-600 text-white hover:bg-blue-700" 
      : "bg-gray-200 text-gray-700 hover:bg-gray-300";
  };

  const handleDelete = (product: any) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    await supabase.from('categories').delete().eq('codigo', productToDelete.codigo).eq('user_id', user?.id);
    setDeleteDialogOpen(false);
    setDeleting(false);
    setProductToDelete(null);
    setAllProducts(prev => prev.filter(p => p.codigo !== productToDelete.codigo));
  };

  const handleEdit = (product: any) => {
    setProductToEdit(product);
    setEditForm({ ...product });
    setEditDialogOpen(true);
  };

  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const confirmEdit = async () => {
    if (!productToEdit || !user) return;
    setEditing(true);
    try {
      const { error } = await supabase
        .from('categories')
        .update({ ...editForm })
        .match({ codigo: productToEdit.codigo, user_id: user.id });
      if (error) throw error;
      setEditDialogOpen(false);
      setProductToEdit(null);
      setEditForm({});
      setAllProducts(prev => prev.map(p => (p.codigo === productToEdit.codigo ? { ...p, ...editForm } : p)));
      toast({ title: 'Éxito', description: 'Producto actualizado correctamente.', variant: 'default' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditing(false);
    }
  };

  return (
    <MainLayout title={t("products.title")}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-3">
              <h2 className="font-medium">{t("products.filters")}</h2>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label
                  htmlFor="category"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t("products.category")}
                </label>
                <select
                  id="category"
                  name="category"
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                  value={filters.category}
                  onChange={(e) => handleFilterChange("category", e.target.value)}
                  disabled={dataStore.categories.length === 0}
                >
                  <option value="all">{t("products.allCategories")}</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="mb-4">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t("products.searchByDescription")}
                </label>
                <input
                  type="text"
                  name="description"
                  id="description"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder={t("products.searchPlaceholder")}
                  value={filters.description}
                  onChange={(e) => handleFilterChange("description", e.target.value)}
                  disabled={dataStore.categories.length === 0}
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t("products.searchByCode")}
                </label>
                <input
                  type="text"
                  name="code"
                  id="code"
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder={t("products.searchByCodePlaceholder")}
                  value={filters.code}
                  onChange={(e) => handleFilterChange("code", e.target.value)}
                  disabled={dataStore.categories.length === 0}
                />
              </div>
              
              <button
                className={`w-full px-4 py-2 rounded-md ${
                  dataStore.categories.length === 0
                    ? "bg-gray-300 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                }`}
                onClick={() => applyFilters(dataStore.categories, filters)}
                disabled={dataStore.categories.length === 0}
              >
                {t("products.applyFilter")}
              </button>
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
              <h2 className="font-medium">
                {t("products.total", { count: allProducts.length })}
              </h2>
              <div className="flex items-center space-x-2">
                <span className="text-sm">{t("products.sortBy")}</span>
                <button
                  onClick={() => handleSort("unidadesVendidas")}
                  className={`px-3 py-1 text-sm rounded-md ${getButtonStyle("unidadesVendidas")}`}
                >
                  {t("products.unitsSold")}
                </button>
                <button
                  onClick={() => handleSort("totalVenta")}
                  className={`px-3 py-1 text-sm rounded-md ${getButtonStyle("totalVenta")}`}
                >
                  {t("products.totalSales")}
                </button>
                <button
                  onClick={() => handleSort("margenPmc")}
                  className={`px-3 py-1 text-sm rounded-md ${getButtonStyle("margenPmc")}`}
                >
                  {t("products.margin")}
                </button>
                <button
                  onClick={() => handleSort("stockActual")}
                  className={`px-3 py-1 text-sm rounded-md ${getButtonStyle("stockActual")}`}
                >
                  {t("products.stock")}
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              {dataStore.categories.length === 0 ? (
                <EmptyState />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("products.code")}</TableHead>
                      <TableHead>{t("products.description")}</TableHead>
                      <TableHead>{t("products.category")}</TableHead>
                      <TableHead>{t("products.price")}</TableHead>
                      <TableHead>{t("products.unitsSold")}</TableHead>
                      <TableHead>{t("products.totalSales")}</TableHead>
                      <TableHead>{t("products.margin")}</TableHead>
                      <TableHead>{t("products.stock")}</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.length > 0 ? (
                      paginatedProducts.map((product, index) => (
                        <TableRow key={product.codigo || index}>
                          <TableCell className="font-medium">
                            {product.codigo}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {product.descripcion}
                          </TableCell>
                          <TableCell>
                            {product.familia}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(product.pvp)}
                          </TableCell>
                          <TableCell>
                            {product.unidadesVendidas}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(product.totalVenta)}
                          </TableCell>
                          <TableCell>
                            <span className={`${getMarginColor(product.margenPmc)}`}>
                              {formatPercent(product.margenPmc)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`${getStockColor(product.stockActual)}`}>
                              {product.stockActual}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button className="text-blue-600 hover:underline mr-2" onClick={() => handleEdit(product)}>Editar</button>
                            <button className="text-red-600 hover:underline" onClick={() => handleDelete(product)}>Eliminar</button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center">
                          {t("common.noData")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
            
            {allProducts.length > itemsPerPage && (
              <div className="bg-white px-4 py-3 flex justify-center items-center border-t border-gray-200">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(currentPage - 1);
                        }}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    
                    {getPageNumbers().map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={currentPage === page}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#" 
                        onClick={(e) => {
                          e.preventDefault();
                          handlePageChange(currentPage + 1);
                        }}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <Dialog open={deleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <pre className="bg-gray-100 p-2 rounded text-xs mb-2">{JSON.stringify(productToDelete, null, 2)}</pre>
            <DialogFooter>
              <button className="px-4 py-2 bg-red-600 text-white rounded" onClick={confirmDelete} disabled={deleting}>
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
                Cancelar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {/* Edit Dialog */}
      {editDialogOpen && (
        <Dialog open={editDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar producto</DialogTitle>
              <DialogDescription>Modifica los campos y guarda los cambios.</DialogDescription>
            </DialogHeader>
            <form className="space-y-2">
              {Object.keys(editForm).map((key) => (
                <div key={key} className="flex flex-col">
                  <label className="text-xs font-semibold mb-1">{key}</label>
                  <input
                    className="border rounded px-2 py-1 text-sm"
                    name={key}
                    value={editForm[key] ?? ''}
                    onChange={handleEditFormChange}
                    disabled={editing || key === 'codigo'}
                  />
                </div>
              ))}
            </form>
            <DialogFooter>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={confirmEdit} disabled={editing}>
                {editing ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setEditDialogOpen(false)} disabled={editing}>
                Cancelar
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
};

const getMarginColor = (margin: number) => {
  if (margin > 20) return "text-green-600";
  if (margin > 0) return "text-blue-600";
  return "text-red-600";
};

const getStockColor = (stock: number) => {
  if (stock > 10) return "text-green-600";
  if (stock > 0) return "text-yellow-600";
  return "text-red-600";
};

export default Products;
