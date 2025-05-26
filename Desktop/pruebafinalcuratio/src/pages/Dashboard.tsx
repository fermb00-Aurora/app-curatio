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
  const { filteredTransactions, categories, setDateRange } = useData();
  const { 
    stats, 
    salesByDayData, 
    salesByCategoryData, 
    formatCurrency: dashboardFormatCurrency
  } = useDashboardData(filteredTransactions);
  
  console.log(`Dashboard rendering with ${filteredTransactions.length} transactions`);
  console.log("Current stats:", stats);

  const handleExportPdf = async () => {
    await exportToPdf("dashboard", "dashboard.pdf");
  };

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

    filteredTransactions.forEach(item => {
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
        const category = categories.find(cat => cat.codigo === transactionCodigo);
        const description = category?.descripcion?.trim() || item.clienteDescripcion?.trim() || transactionCodigo;
        
        productSales.set(transactionCodigo, {
          codigo: transactionCodigo,
          description: description,
          units: transactionUnits,
          total: importeNeto,
        });
      }
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [filteredTransactions, categories]);

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
          units: day.units + unidades,
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
