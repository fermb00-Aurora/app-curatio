
import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import MainLayout from "@/components/layout/MainLayout";
import { useDataContext } from "@/contexts/DataContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { FileText } from "lucide-react";
import { exportToPdf } from "@/utils/pdfExport";
import { Button } from "@/components/ui/button";

const Sellers = () => {
  const { t, i18n } = useTranslation();
  const { filteredTransactions } = useDataContext();
  const [paymentTypes, setPaymentTypes] = useState<string[]>([]);
  const [selectedPaymentType, setSelectedPaymentType] = useState("all");
  const [sellersSummary, setSellersSummary] = useState<any[]>([]);

  // Get unique payment types
  useEffect(() => {
    const uniquePaymentTypes = Array.from(
      new Set(filteredTransactions.map((t) => t.tipoPago))
    ).filter(Boolean) as string[];
    setPaymentTypes(uniquePaymentTypes);
  }, [filteredTransactions]);

  // Update summary when payment type filter changes
  useEffect(() => {
    let transactionsToProcess = [...filteredTransactions];
    
    if (selectedPaymentType !== "all") {
      transactionsToProcess = transactionsToProcess.filter(
        (t) => t.tipoPago === selectedPaymentType
      );
    }
    
    generateSellersSummary(transactionsToProcess);
  }, [selectedPaymentType, filteredTransactions]);

  // Generate sellers summary data
  const generateSellersSummary = (transactions: any[]) => {
    const sellerMap = new Map();
    
    transactions.forEach((transaction) => {
      const seller = transaction.vendedor || t("common.unknown");
      const importeNeto = Number(transaction.importeNeto) || 0;
      
      if (sellerMap.has(seller)) {
        const summary = sellerMap.get(seller);
        sellerMap.set(seller, {
          ...summary,
          totalSales: summary.totalSales + importeNeto,
          transactionCount: summary.transactionCount + 1,
        });
      } else {
        sellerMap.set(seller, {
          seller,
          totalSales: importeNeto,
          transactionCount: 1,
          averagePerTransaction: 0,
        });
      }
    });
    
    // Calculate average per transaction
    const summaryArray = Array.from(sellerMap.values()).map((item) => ({
      ...item,
      averagePerTransaction: item.transactionCount > 0
        ? item.totalSales / item.transactionCount
        : 0,
    }));
    
    // Sort by total sales descending
    summaryArray.sort((a, b) => b.totalSales - a.totalSales);
    
    // Add a total row
    const totalSales = summaryArray.reduce((sum, item) => sum + item.totalSales, 0);
    const totalTransactions = summaryArray.reduce((sum, item) => sum + item.transactionCount, 0);
    
    summaryArray.push({
      seller: t("common.total"),
      totalSales,
      transactionCount: totalTransactions,
      averagePerTransaction: totalTransactions > 0
        ? totalSales / totalTransactions
        : 0,
      isTotal: true,
    });
    
    setSellersSummary(summaryArray);
  };

  // Prepare chart data
  const getChartData = () => {
    return sellersSummary
      .filter((item) => !item.isTotal)
      .map((item) => ({
        name: item.seller,
        value: item.totalSales,
      }));
  };

  const handleExportPDF = async () => {
    await exportToPdf('sellers-content', 'sellers-report.pdf');
  };

  const formatCurrency = (value: number) => {
    const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';
    return value.toLocaleString(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <MainLayout
      title={t("sellers.title")}
      rightHeaderContent={
        <Button 
          className="flex items-center"
          onClick={handleExportPDF}
        >
          <FileText className="h-5 w-5 mr-2" />
          {t("sellers.exportPDF")}
        </Button>
      }
    >
      <div id="sellers-content">
        {/* Payment Type Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 mr-3">
              {t("sellers.paymentType")}:
            </label>
            <select
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value)}
            >
              <option value="all">{t("sellers.all")}</option>
              {paymentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <button
              className="ml-3 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={() => setSelectedPaymentType("all")}
            >
              {t("sellers.filter")}
            </button>
          </div>
        </div>

        {/* Sales by Seller Chart */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
          <div className="bg-gray-800 text-white px-4 py-3">
            <h2 className="font-medium">{t("sellers.salesDistributionBySeller")}</h2>
          </div>
          <div className="p-4" style={{ height: "400px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getChartData()} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(value) => `${t("sellers.seller")}: ${value}`}
                />
                <Bar dataKey="value" fill="#3b82f6" name={t("sellers.totalSales")} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sellers Summary Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="bg-gray-800 text-white px-4 py-3">
            <h2 className="font-medium">{t("sellers.sellersSummary")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("sellers.seller")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("sellers.totalSales")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("sellers.transactionsNumber")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("sellers.averagePerTransaction")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sellersSummary.map((seller, index) => (
                  <tr
                    key={index}
                    className={
                      seller.isTotal
                        ? "bg-gray-100 font-medium"
                        : index % 2 === 0
                        ? "bg-white"
                        : "bg-gray-50"
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {seller.seller}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(seller.totalSales)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {seller.transactionCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(seller.averagePerTransaction)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Sellers;
