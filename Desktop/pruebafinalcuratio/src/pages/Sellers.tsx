import React from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "@/components/layout/MainLayout";
import { useData } from "@/contexts/DataContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "@/utils/formatters";

const Sellers = () => {
  const { t } = useTranslation();
  const { filteredTransactions, setDateRange } = useData();

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    setDateRange(range.from, range.to);
  };

  const sellerData = React.useMemo(() => {
    const sellerMap = new Map<string, { name: string; sales: number; returns: number }>();

    filteredTransactions.forEach((transaction) => {
      const seller = transaction.vendedor || "Unknown";
      const current = sellerMap.get(seller) || { name: seller, sales: 0, returns: 0 };

      if (transaction.tipo === "V") {
        current.sales += transaction.importeNeto;
      } else if (transaction.tipo === "D") {
        current.returns += Math.abs(transaction.importeNeto);
      }

      sellerMap.set(seller, current);
    });

    return Array.from(sellerMap.values())
      .map((data) => ({
        ...data,
        netSales: data.sales - data.returns,
      }))
      .sort((a, b) => b.netSales - a.netSales);
  }, [filteredTransactions]);

  return (
    <MainLayout
      title={t("sellers.title")}
      onDateRangeChange={handleDateRangeChange}
    >
      <div className="bg-white rounded-lg shadow overflow-hidden space-y-4">
        <div className="bg-gray-800 text-white px-4 py-3">
          <h2 className="font-medium">{t("sellers.salesBySeller")}</h2>
        </div>

        <div className="p-4">
          <div className="h-[500px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sellerData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => t("sellers.seller", { name: label })}
                />
                <Legend />
                <Bar
                  dataKey="sales"
                  name={t("sellers.sales")}
                  fill="#4f46e5"
                  stackId="a"
                />
                <Bar
                  dataKey="returns"
                  name={t("sellers.returns")}
                  fill="#ef4444"
                  stackId="a"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {t("sellers.sellerDetails")}
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("sellers.seller")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("sellers.sales")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("sellers.returns")}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("sellers.netSales")}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sellerData.map((seller) => (
                    <tr key={seller.name}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {seller.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(seller.sales)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(seller.returns)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(seller.netSales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Sellers;
