import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  Sector,
} from "recharts";
import ChartWrapper from "@/components/chatbot/ChartWrapper";
import { useDataContext } from "@/contexts/DataContext";
import { trackMetric } from "@/utils/analytics";

// Improved color palette for up to 14 categories, visually distinct
const COLORS = [
  "#a6c8ff", // 1. light blue
  "#78a9ff", // 2. blue
  "#bb8fff", // 3. purple
  "#ffe082", // 4. yellow
  "#76d7c4", // 5. mint
  "#ffb3ba", // 6. pink
  "#ffd6a5", // 7. light orange
  "#93ff94", // 8. light green
  "#ffe0ac", // 9. sand
  "#ffd6cb", // 10. peach
  "#f6e58d", // 11. pale yellow
  "#e2baff", // 12. lavender
  "#fab1a0", // 13. salmon
  "#ffe9b3"  // 14. pale yellow
];

interface DashboardChartsProps {
  salesByDayData: Array<{ fecha: string; importe: number }>;
  // salesByCategoryData is ignored for donut - we compute from transactions below
  salesByCategoryData: Array<{ name: string; value: number }>;
  formatCurrency: (value: number) => string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  salesByDayData,
  salesByCategoryData,
  formatCurrency,
  dateRange,
}) => {
  const { t } = useTranslation();
  const { filteredTransactions, dataStore } = useDataContext();

  // Compute ventas por categoría directly from filtered transactions
  const salesDistributionData = React.useMemo(() => {
    const categoryMap = new Map<string, number>();
    let total = 0;

    filteredTransactions.forEach(item => {
      // Find category using the product code
      const cat = dataStore.categories.find(c => c.codigo === item.codigo);
      const catName = cat?.familia ?? "null";
      const importeNeto = Number(item.importeNeto) || 0;
      if (!categoryMap.has(catName)) categoryMap.set(catName, importeNeto);
      else categoryMap.set(catName, categoryMap.get(catName)! + importeNeto);
      total += importeNeto;
    });

    let array = Array.from(categoryMap, ([name, value]) => ({ name, value }));
    // Sort by value desc, keep only the top 12, rest merged into "Otros"
    if (array.length > 13) {
      const top12 = array.sort((a, b) => b.value - a.value).slice(0, 12);
      const othersVal = array.slice(12).reduce((acc, cur) => acc + cur.value, 0);
      return [
        ...top12,
        { name: t("dashboard.others") || "Otros", value: othersVal }
      ];
    }
    return array.sort((a, b) => b.value - a.value);
  }, [filteredTransactions, dataStore.categories, t]);

  // To avoid displaying zeros, filter out categories with no sales
  const filteredSalesData = salesDistributionData.filter(c => c.value > 0);

  return (
    <div id="charts-section" className="grid grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
          <h3 className="font-medium">{t("dashboard.salesByDate")}</h3>
          <span className="text-xs opacity-75">
            {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
          </span>
        </div>
        <div className="p-4" style={{ height: "320px" }}>
          {salesByDayData.length > 0 ? (
            <ChartWrapper
              chartId="salesByDay"
              chartType="bar"
              data={salesByDayData}
              title={t("dashboard.salesByDate")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDayData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  <Bar dataKey="importe" fill="#0088FE" name={t("dashboard.sales")} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {t("dashboard.noDataAvailable")}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
          <h3 className="font-medium">{t("dashboard.salesByCategory")}</h3>
          <span className="text-xs opacity-75">
            {dateRange.startDate.toLocaleDateString()} - {dateRange.endDate.toLocaleDateString()}
          </span>
        </div>
        <div className="p-4" style={{ height: "320px" }}>
          {filteredSalesData.length > 0 ? (
            <ChartWrapper
              chartId="salesByCategory"
              chartType="donut"
              data={filteredSalesData}
              title={t("dashboard.salesByCategory")}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={filteredSalesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={76}
                    fill="#0088FE"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) =>
                      `${name} ${percent && percent > 0 ? (percent * 100).toFixed(2) + "%" : ""}`
                    }
                  >
                    {filteredSalesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) =>
                      [formatCurrency(value), name]
                    }
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            </ChartWrapper>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {t("dashboard.noDataAvailable")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
