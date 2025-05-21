import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Transaction } from "@/utils/dataTypes";

export const useDashboardData = (filteredTransactions: Transaction[]) => {
  const { i18n } = useTranslation();

  const stats = useMemo(() => {
    console.log(`Processing ${filteredTransactions.length} transactions for stats`);
    if (filteredTransactions.length > 0) {
      console.log("Sample transaction:", filteredTransactions[0]);
      console.log("Sample unidades value:", filteredTransactions[0].unidades);
    }
    
    return filteredTransactions.reduce(
      (acc, item) => {
        const importeBruto = Number(item.importeBruto) || 0;
        const importeNeto = Number(item.importeNeto) || 0;
        
        const unidades = Number(item.unidades) || 0;
        
        if (unidades !== 0 && isNaN(unidades)) {
          console.log("Found NaN unidades value:", item.unidades, "in item:", item);
        }
        
        const isReturn = importeBruto < 0;
        
        return {
          totalSales: acc.totalSales + (isReturn ? 0 : importeBruto),
          totalReturns: acc.totalReturns + (isReturn ? Math.abs(importeBruto) : 0),
          netSales: acc.netSales + importeNeto,
          unitsSold: acc.unitsSold + unidades,
        };
      },
      { totalSales: 0, totalReturns: 0, netSales: 0, unitsSold: 0 }
    );
  }, [filteredTransactions]);

  console.log("Calculated stats:", stats);

  const salesByDayData = useMemo(() => {
    const dateMap = new Map();
    
    filteredTransactions.forEach(item => {
      const fecha = item.fecha;
      if (!fecha) return;
      
      const importeNeto = Number(item.importeNeto) || 0;
      
      if (dateMap.has(fecha)) {
        dateMap.set(fecha, dateMap.get(fecha) + importeNeto);
      } else {
        dateMap.set(fecha, importeNeto);
      }
    });
    
    return Array.from(dateMap, ([fecha, importe]) => ({ fecha, importe }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredTransactions]);

  const salesByCategoryData = useMemo(() => {
    const categoryMap = new Map();
    
    filteredTransactions.forEach(item => {
      const codigo = item.codigo;
      if (!codigo) return;
      
      const category = codigo.substring(0, 2);
      const importeNeto = Number(item.importeNeto) || 0;
      
      if (categoryMap.has(category)) {
        categoryMap.set(category, categoryMap.get(category) + importeNeto);
      } else {
        categoryMap.set(category, importeNeto);
      }
    });
    
    return Array.from(categoryMap, ([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  const formatCurrency = (value: number) => {
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    
    return value.toLocaleString(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return {
    stats,
    salesByDayData,
    salesByCategoryData,
    formatCurrency,
  };
};
