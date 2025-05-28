import React from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "@/components/layout/MainLayout";
import { FileUpIcon, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell
} from "@/components/ui/table";
import { useDataContext } from "@/contexts/DataContext";
import { useTransactionTable } from "@/hooks/useTransactionTable";
import { filterDataByDateRange } from "@/utils/dataStorage";
import { supabase } from '../../frontend/src/services/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';

const Transactions = () => {
  const { t } = useTranslation();
  const { dataStore } = useDataContext();
  const [dateFilteredTransactions, setDateFilteredTransactions] = React.useState(dataStore.transactions);
  
  const {
    paginatedTransactions,
    currentPage,
    setCurrentPage,
    totalPages,
    searchTerm,
    setSearchTerm,
  } = useTransactionTable(dateFilteredTransactions);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [transactionToDelete, setTransactionToDelete] = React.useState<any>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    const filtered = filterDataByDateRange(dataStore.transactions, range.from, range.to);
    setDateFilteredTransactions(filtered);
    setCurrentPage(1);
  };

  const getPageNumbers = () => {
    const pages = [];
    const currentPageNum = currentPage;
    
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = currentPageNum - 1;
      let end = currentPageNum + 1;
      
      if (start < 1) {
        start = 1;
        end = 3;
      } else if (end > totalPages) {
        end = totalPages;
        start = totalPages - 2;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  const handleDelete = (transaction: any) => {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!transactionToDelete) return;
    setDeleting(true);
    await supabase.from('transactions').delete().eq('id', transactionToDelete.id);
    setDeleteDialogOpen(false);
    setDeleting(false);
    setTransactionToDelete(null);
    // Remove from UI
    setDateFilteredTransactions(prev => prev.filter(t => t.id !== transactionToDelete.id));
  };

  return (
    <MainLayout 
      title={t("transactions.title")}
      onDateRangeChange={handleDateRangeChange}
    >
      <div className="bg-white rounded-lg shadow overflow-hidden space-y-4">
        <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
          <h2 className="font-medium">{t("transactions.transactionsList")}</h2>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-100">
              {t("transactions.total", { count: dateFilteredTransactions.length })}
            </span>
            <Link to="/upload">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-blue-600 text-white hover:bg-blue-700 border-blue-600 hover:border-blue-700 transition-colors duration-300 ease-in-out"
              >
                <FileUpIcon className="h-4 w-4 mr-2" />
                {t("upload.goToUpload")}
              </Button>
            </Link>
          </div>
        </div>

        <div className="px-4">
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder={t("transactions.searchByDescription")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 py-2 w-24">Fecha</TableHead>
                <TableHead className="px-2 py-2 w-20">Hora</TableHead>
                <TableHead className="px-2 py-2 w-24">Vendedor</TableHead>
                <TableHead className="px-2 py-2 w-24">Código</TableHead>
                <TableHead className="px-2 py-2 w-48">{t("transactions.description")}</TableHead>
                <TableHead className="px-2 py-2 w-20">Tipo</TableHead>
                <TableHead className="px-2 py-2 w-16">TA</TableHead>
                <TableHead className="px-2 py-2 w-16">Uni.</TableHead>
                <TableHead className="px-2 py-2 text-right">P.Ant.</TableHead>
                <TableHead className="px-2 py-2 w-24 text-right">P.V.P.</TableHead>
                <TableHead className="px-2 py-2 w-24 text-right">Imp. Bruto</TableHead>
                <TableHead className="px-2 py-2 text-right">Dto.</TableHead>
                <TableHead className="px-2 py-2 w-24 text-right">Imp. Neto</TableHead>
                <TableHead className="px-2 py-2 w-28">Número Doc.</TableHead>
                <TableHead className="px-2 py-2 w-16">R.P.</TableHead>
                <TableHead className="px-2 py-2 w-16">Fact.</TableHead>
                <TableHead className="px-2 py-2 text-right">A Cuenta</TableHead>
                <TableHead className="px-2 py-2 text-right">Entrega</TableHead>
                <TableHead className="px-2 py-2 text-right">Devoluc.</TableHead>
                <TableHead className="px-2 py-2 w-28">Tipo de Pago</TableHead>
                <TableHead className="px-2 py-2 w-24">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((transaction, index) => (
                  <TableRow 
                    key={`${transaction.numeroDoc || ''}-${index}`}
                    className="hover:bg-gray-50"
                  >
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.fecha}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.hora}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.vendedor}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.codigo}</TableCell>
                    <TableCell className="px-2 py-2 max-w-[150px] truncate">{transaction.clienteDescripcion}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.tipo}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.ta}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.unidades}</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.precioAnterior?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.pvp?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.importeBruto?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.descuento?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.importeNeto?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.numeroDoc}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.rp}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.fact}</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.aCuenta?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.entrega?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 text-right whitespace-nowrap">{transaction.devolucion?.toFixed(2)}€</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">{transaction.tipoPago}</TableCell>
                    <TableCell className="px-2 py-2 whitespace-nowrap">
                      <button className="text-blue-600 hover:underline mr-2" onClick={() => alert('Editar (próximamente)')}>Editar</button>
                      <button className="text-red-600 hover:underline" onClick={() => handleDelete(transaction)}>Eliminar</button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <FileUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-gray-500 mb-2">{t("common.noData")}</p>
                      <p className="text-sm text-gray-400 mb-4">{t("upload.noTransactionsPrompt")}</p>
                      <Link to="/upload">
                        <Button className="flex items-center gap-2">
                          <FileUpIcon className="h-4 w-4" />
                          {t("upload.goToUpload")}
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="py-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  {currentPage > 1 ? (
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    />
                  ) : (
                    <span className="opacity-50 cursor-not-allowed flex gap-1 pl-2.5 h-10 px-4 py-2 items-center">
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </span>
                  )}
                </PaginationItem>
                
                {getPageNumbers().map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  {currentPage < totalPages ? (
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    />
                  ) : (
                    <span className="opacity-50 cursor-not-allowed flex gap-1 pr-2.5 h-10 px-4 py-2 items-center">
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteDialogOpen && (
        <Dialog open={deleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar esta transacción? Esta acción no se puede deshacer.
              </DialogDescription>
            </DialogHeader>
            <pre className="bg-gray-100 p-2 rounded text-xs mb-2">{JSON.stringify(transactionToDelete, null, 2)}</pre>
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
    </MainLayout>
  );
};

export default Transactions;

