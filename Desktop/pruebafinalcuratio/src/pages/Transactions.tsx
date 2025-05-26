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
import { useData } from "@/contexts/DataContext";
import { useTransactionTable } from "@/hooks/useTransactionTable";
import { filterDataByDateRange } from "@/utils/dataStorage";
import { formatCurrency } from "@/utils/formatters";
import { Transaction } from "@/utils/dataTypes";

const ITEMS_PER_PAGE = 15;

const Transactions = () => {
  const { t } = useTranslation();
  const { filteredTransactions, categories, setDateRange } = useData();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range.from, range.to);
  };

  const filteredData = React.useMemo(() => {
    let filtered = [...filteredTransactions];

    if (searchTerm) {
      filtered = filtered.filter((transaction) =>
        transaction.clienteDescripcion.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [filteredTransactions, searchTerm]);

  const paginatedData = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);

  React.useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

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
              {t("transactions.total", { count: filteredTransactions.length })}
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
                <TableHead>{t("transactions.date")}</TableHead>
                <TableHead>{t("transactions.code")}</TableHead>
                <TableHead>{t("transactions.description")}</TableHead>
                <TableHead>{t("transactions.units")}</TableHead>
                <TableHead>{t("transactions.grossAmount")}</TableHead>
                <TableHead>{t("transactions.netAmount")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((transaction, index) => {
                  const category = categories.find(cat => cat.codigo === transaction.codigo);
                  return (
                    <TableRow key={`${transaction.numeroDoc}-${index}`}>
                      <TableCell>{transaction.fecha}</TableCell>
                      <TableCell>{transaction.codigo}</TableCell>
                      <TableCell>{category?.descripcion || transaction.clienteDescripcion}</TableCell>
                      <TableCell>{transaction.unidades}</TableCell>
                      <TableCell>{formatCurrency(transaction.importeBruto)}</TableCell>
                      <TableCell>{formatCurrency(transaction.importeNeto)}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
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
    </MainLayout>
  );
};

export default Transactions;

