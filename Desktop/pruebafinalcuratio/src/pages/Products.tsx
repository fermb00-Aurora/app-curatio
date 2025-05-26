import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { FileUpIcon, ChevronLeft, ChevronRight } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { useData } from "@/contexts/DataContext";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { formatCurrency } from "@/utils/formatters";
import { Category } from "@/utils/dataTypes";

const ITEMS_PER_PAGE = 15;

const Products = () => {
  const { t } = useTranslation();
  const { categories, setDateRange } = useData();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range.from, range.to);
  };

  const filteredData = React.useMemo(() => {
    let filtered = [...categories];

    if (searchTerm) {
      filtered = filtered.filter((category) =>
        category.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [categories, searchTerm]);

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
      title={t("products.title")}
      onDateRangeChange={handleDateRangeChange}
    >
      <div className="bg-white rounded-lg shadow overflow-hidden space-y-4">
        <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
          <h2 className="font-medium">{t("products.productsList")}</h2>
          <div className="flex items-center space-x-4">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-gray-100">
              {t("products.total", { count: categories.length })}
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
            <input
              type="search"
              placeholder={t("products.searchByCodeOrDescription")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("products.code")}</TableHead>
                <TableHead>{t("products.description")}</TableHead>
                <TableHead>{t("products.family")}</TableHead>
                <TableHead>{t("products.presentation")}</TableHead>
                <TableHead>{t("products.stock")}</TableHead>
                <TableHead>{t("products.price")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                paginatedData.map((product) => (
                  <TableRow key={product.codigo}>
                    <TableCell>{product.codigo}</TableCell>
                    <TableCell>{product.descripcion}</TableCell>
                    <TableCell>{product.familia}</TableCell>
                    <TableCell>{product.presentacion}</TableCell>
                    <TableCell>{product.stockActual}</TableCell>
                    <TableCell>{formatCurrency(product.pvp)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex flex-col items-center justify-center py-8">
                      <FileUpIcon className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-gray-500 mb-2">{t("common.noData")}</p>
                      <p className="text-sm text-gray-400 mb-4">{t("upload.noProductsPrompt")}</p>
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

export default Products;
