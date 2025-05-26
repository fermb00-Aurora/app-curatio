import React from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "@/components/layout/MainLayout";
import { useData } from "@/contexts/DataContext";
import { FileText } from "lucide-react";
import { exportToPdf } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardTables } from "@/components/dashboard/DashboardTables";
import { formatCurrency } from "@/utils/formatters";

const Dashboard = () => {
  const { t } = useTranslation();
  const { filteredTransactions, categories } = useData();
  const { stats, salesByDayData, salesByCategoryData, formatCurrency: dashboardFormatCurrency } = useDashboardData(filteredTransactions);
  
  console.log(`Dashboard rendering with ${filteredTransactions.length} transactions`);
  console.log("Current stats:", stats);

  const handleExportPdf = async () => {
    await exportToPdf("dashboard", "dashboard.pdf");
  };

  // Compute sales by day
  const salesByDayData = React.useMemo(() => {
    const sales = new Map<string, number>();
    
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.fecha).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit'
      });
      const currentTotal = sales.get(date) || 0;
      sales.set(date, currentTotal + transaction.importeNeto);
    });

    return Array.from(sales.entries())
      .map(([fecha, importe]) => ({
        fecha,
        importe: Number(importe.toFixed(2))
      }))
      .sort((a, b) => {
        const [dayA, monthA] = a.fecha.split('/');
        const [dayB, monthB] = b.fecha.split('/');
        return new Date(2024, parseInt(monthA) - 1, parseInt(dayA))
          .getTime() - new Date(2024, parseInt(monthB) - 1, parseInt(dayB))
          .getTime();
      });
  }, [filteredTransactions]);

  // Compute sales by category
  const salesByCategoryData = React.useMemo(() => {
    const sales = new Map<string, number>();
    
    filteredTransactions.forEach(transaction => {
      const category = categories.find(cat => cat.codigo === transaction.codigo);
      const categoryName = category?.familia || t("common.unknown");
      const currentTotal = sales.get(categoryName) || 0;
      sales.set(categoryName, currentTotal + transaction.importeNeto);
    });

    return Array.from(sales.entries())
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2))
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, categories, t]);

  // Get date range from transactions
  const dateRange = React.useMemo(() => {
    if (filteredTransactions.length === 0) {
      return {
        startDate: new Date(),
        endDate: new Date()
      };
    }

    const dates = filteredTransactions.map(t => new Date(t.fecha));
    return {
      startDate: new Date(Math.min(...dates.map(d => d.getTime()))),
      endDate: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }, [filteredTransactions]);

  const topSellingProducts = React.useMemo(() => {
    const productSales = new Map<string, {
        codigo: string;
        description: string;
        units: number;
        total: number;
    }>();

    // console.log("Recalculating topSellingProducts. Number of filteredTransactions:", filteredTransactions.length);

    filteredTransactions.forEach((item, index) => {
        // Log the raw values for the first 5 transactions to inspect them
        if (index < 5) {
            console.log(`[topSellingProducts] Processing item ${index}: codigo='${item.codigo}', raw unidades='${item.unidades}', typeof unidades=${typeof item.unidades}`);
        }

        const transactionUnits = Number(item.unidades) || 0;
        const transactionCodigo = item.codigo; 

        if (!transactionCodigo || transactionCodigo.trim() === "" || transactionUnits === 0) {
            return;
        }

        const importeNeto = Number(item.importeNeto) || 0;
        let currentEntry = productSales.get(transactionCodigo);

        if (currentEntry) {
            currentEntry.units += transactionUnits;
            currentEntry.total += importeNeto;
        } else {
            const catalogProduct = dataStore.categories.find(cat => cat.codigo === transactionCodigo);
            const description = catalogProduct?.descripcion?.trim() || item.clienteDescripcion?.trim() || transactionCodigo; 
            
            productSales.set(transactionCodigo, {
                codigo: transactionCodigo,
                description: description,
                units: transactionUnits,
                total: importeNeto,
            });
        }
    });

    const aggregatedProducts = Array.from(productSales.values());
    // Sort by total sales descending
    const sortedProducts = aggregatedProducts.sort((a, b) => b.total - a.total); 
    const top10 = sortedProducts.slice(0, 10); // Take top 10
    return top10;

  }, [filteredTransactions, dataStore.categories, t]);

  const dailySummary = React.useMemo(() => {
    const dateMap = new Map();
    
    filteredTransactions.forEach(item => {
      const fecha = item.fecha;
      if (!fecha) return;
      
      const unidades = Number(item.unidades) || 0;
      const importeBruto = Number(item.importeBruto) || 0;
      const importeNeto = Number(item.importeNeto) || 0;
      const isReturn = importeBruto < 0;
      
      if (dateMap.has(fecha)) {
        const day = dateMap.get(fecha);
        dateMap.set(fecha, {
          ...day,
          transactions: day.transactions + 1,
          units: day.units + unidades, // Sumamos todas las unidades (positivas y negativas)
          sales: day.sales + (isReturn ? 0 : importeBruto),
          returns: day.returns + (isReturn ? Math.abs(importeBruto) : 0),
          net: day.net + importeNeto,
        });
      } else {
        dateMap.set(fecha, {
          date: fecha,
          transactions: 1,
          units: unidades,
          sales: isReturn ? 0 : importeBruto,
          returns: isReturn ? Math.abs(importeBruto) : 0,
          net: importeNeto,
        });
      }
    });
    
    return Array.from(dateMap.values())
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 7);
  }, [filteredTransactions]);

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range.from, range.to);
  };

  return (
    <MainLayout
      title={t("dashboard.title")}
      rightHeaderContent={
        <Button 
          className="flex items-center"
          onClick={handleExportPdf}
        >
          <FileText className="h-5 w-5 mr-2" />
          {t("sellers.exportPDF")}
        </Button>
      }
      onDateRangeChange={handleDateRangeChange}
    >
      <div id="dashboard-content">
        <StatsCards stats={stats} formatCurrency={dashboardFormatCurrency} />
        <DashboardCharts
          salesByDayData={salesByDayData}
          salesByCategoryData={salesByCategoryData}
          formatCurrency={formatCurrency}
          dateRange={dateRange}
        />
        <DashboardTables
          topSellingProducts={topSellingProducts}
          dailySummary={dailySummary}
          formatCurrency={formatCurrency}
        />
      </div>
    </MainLayout>
  );
};

export default Dashboard;
