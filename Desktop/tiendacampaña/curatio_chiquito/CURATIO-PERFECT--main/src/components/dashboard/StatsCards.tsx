import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { DollarSign, ArrowLeft, CircleDollarSign, Package } from "lucide-react";
import { trackMetric } from "@/utils/analytics";

interface StatsCardsProps {
  stats: {
    totalSales: number;
    totalReturns: number;
    netSales: number;
    unitsSold: number;
  };
  formatCurrency: (value: number) => string;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, formatCurrency }) => {
  const { t } = useTranslation();
  
  // Add logging to debug the stats being received
  console.log("StatsCards rendering with stats:", stats);

  // Track metrics when stats change
  useEffect(() => {
    trackMetric({
      id: "totalSales",
      value: stats.totalSales,
      label: t("dashboard.totalSales"),
      type: "currency"
    });
    
    trackMetric({
      id: "totalReturns",
      value: stats.totalReturns,
      label: t("dashboard.totalReturns"),
      type: "currency"
    });
    
    trackMetric({
      id: "netSales",
      value: stats.netSales,
      label: t("dashboard.netSales"),
      type: "currency"
    });
    
    trackMetric({
      id: "unitsSold",
      value: stats.unitsSold,
      label: t("dashboard.unitsSold"),
      type: "number"
    });
  }, [stats, t]);

  return (
    <div id="stats-cards" className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center">
        <div className="text-blue-500 mb-2">
          <DollarSign className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold truncate w-full text-center">{formatCurrency(stats.totalSales)}</div>
        <div className="text-gray-500 text-xs uppercase tracking-wide truncate w-full text-center">{t("dashboard.totalSales")}</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center">
        <div className="text-red-500 mb-2">
          <ArrowLeft className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold truncate w-full text-center">{formatCurrency(stats.totalReturns)}</div>
        <div className="text-gray-500 text-xs uppercase tracking-wide truncate w-full text-center">{t("dashboard.totalReturns")}</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center">
        <div className="text-green-500 mb-2">
          <CircleDollarSign className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold truncate w-full text-center">{formatCurrency(stats.netSales)}</div>
        <div className="text-gray-500 text-xs uppercase tracking-wide truncate w-full text-center">{t("dashboard.netSales")}</div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow flex flex-col items-center">
        <div className="text-teal-500 mb-2">
          <Package className="h-6 w-6" />
        </div>
        <div className="text-xl font-bold truncate w-full text-center">{stats.unitsSold}</div>
        <div className="text-gray-500 text-xs uppercase tracking-wide truncate w-full text-center">{t("dashboard.unitsSold")}</div>
      </div>
    </div>
  );
};
