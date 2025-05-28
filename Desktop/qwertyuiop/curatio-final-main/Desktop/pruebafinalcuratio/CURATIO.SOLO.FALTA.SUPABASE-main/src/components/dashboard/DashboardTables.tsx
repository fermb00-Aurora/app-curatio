import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trackMetric } from "@/utils/analytics";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

interface DashboardTablesProps {
  topSellingProducts: Array<{
    description: string;
    units: number;
    total: number;
    codigo: string;
  }>;
  dailySummary: Array<{
    date: string;
    transactions: number;
    units: number;
    sales: number;
    returns: number;
    net: number;
  }>;
  formatCurrency: (value: number) => string;
}

export const DashboardTables: React.FC<DashboardTablesProps> = ({
  topSellingProducts,
  dailySummary,
  formatCurrency,
}) => {
  const { t } = useTranslation();

  useEffect(() => {
    trackMetric({
      id: "dashboard_tables_rendered",
      value: 1,
      label: "Dashboard Tables Component Rendered",
      type: "number"
    });
  }, []);

  return (
    <div id="tables-section" className="grid grid-cols-2 gap-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">
              {t("dashboard.topSellingProducts") || "Productos más vendidos"}
            </span>
            <span className="text-xs opacity-70">Total: {topSellingProducts.length}</span>
          </div>
        </div>
        <div className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="px-2 py-2">Código</TableHead>
                  <TableHead className="px-2 py-2">Nombre del Producto</TableHead>
                  <TableHead className="px-2 py-2 text-right">Unidades</TableHead>
                  <TableHead className="px-2 py-2 text-right">Ventas (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSellingProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                ) : (
                  topSellingProducts.map((product, idx) => (
                    <TableRow key={product.codigo + product.description + idx}>
                      <TableCell className="px-2 max-w-[100px] truncate">{product.codigo}</TableCell>
                    <TableCell className="px-2 max-w-[230px] truncate">{product.description}</TableCell>
                    <TableCell className="px-2 text-right">{product.units}</TableCell>
                    <TableCell className="px-2 text-right">{formatCurrency(product.total)}</TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="bg-gray-800 text-white px-4 py-2">
          <h3 className="font-medium">{t("dashboard.dailySummary")}</h3>
        </div>
        <div className="p-3">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("dashboard.date")}
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("dashboard.transactions")}
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("dashboard.sales")}
                  </th>
                  <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("dashboard.net")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dailySummary.slice(0, 4).map((day, index) => (
                  <tr key={index} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                      {day.date}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                      {day.transactions}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                      {formatCurrency(day.sales)}
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap text-xs">
                      {formatCurrency(day.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
