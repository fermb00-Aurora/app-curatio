import React from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "@/components/layout/MainLayout";
import { useDataContext } from "@/contexts/DataContext";
import { FileText } from "lucide-react";
import { exportToPdf } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { DashboardTables } from "@/components/dashboard/DashboardTables";

const Dashboard = () => {
  const { t } = useTranslation();
  const { filteredTransactions, dataStore, setDateRange, dateRange } = useDataContext();
  const { stats, salesByDayData, formatCurrency } = useDashboardData(filteredTransactions);
  
  console.log(`Dashboard rendering with ${filteredTransactions.length} transactions`);
  console.log("Current stats:", stats);

  const salesByCategoryData = React.useMemo(() => {
    const categorySums: Record<string, number> = {};
    filteredTransactions.forEach(item => {
      const product = dataStore.categories.find(cat => cat.codigo === item.codigo);
      const cat = product?.familia || t("common.unknown");
      const importeNeto = Number(item.importeNeto) || 0;
      if (!categorySums[cat]) categorySums[cat] = 0;
      categorySums[cat] += importeNeto;
    });
    return Object.entries(categorySums)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions, dataStore.categories, t]);

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

  const handleExportPDF = async () => {
    await exportToPdf('dashboard-content', 'dashboard-report.pdf');
  };

  return (
    <MainLayout
      title={t("dashboard.title")}
      rightHeaderContent={
        <Button 
          className="flex items-center"
          onClick={handleExportPDF}
        >
          <FileText className="h-5 w-5 mr-2" />
          {t("sellers.exportPDF")}
        </Button>
      }
      onDateRangeChange={handleDateRangeChange}
    >
      <div id="dashboard-content">
        <StatsCards stats={stats} formatCurrency={formatCurrency} />
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
