import { Suspense, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Products from "@/pages/Products";
import Sellers from "@/pages/Sellers";
import UploadFiles from "@/pages/UploadFiles";
import NotFound from "@/pages/NotFound";
import Login from "@/pages/Login";
import { STORAGE_KEYS } from "@/utils/dataStorage";

function App() {
  const { t } = useTranslation();
  
  useEffect(() => {
    console.log("App initialized, checking localStorage");
    const transactionsData = localStorage.getItem(STORAGE_KEYS.transactions);
    const categoriesData = localStorage.getItem(STORAGE_KEYS.categories);
    
    console.log("Local storage status:");
    console.log(`- Transactions: ${transactionsData ? JSON.parse(transactionsData).length : 0} items`);
    console.log(`- Categories: ${categoriesData ? JSON.parse(categoriesData).length : 0} items`);
    
    // Uncomment this line if you need to clear localStorage for debugging
    // localStorage.clear();
  }, []);

  return (
    <AuthProvider>
      <DataProvider>
        <div className="App">
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/transactions" element={
                <ProtectedRoute>
                  <Transactions />
                </ProtectedRoute>
              } />
              <Route path="/products" element={
                <ProtectedRoute>
                  <Products />
                </ProtectedRoute>
              } />
              <Route path="/sellers" element={
                <ProtectedRoute>
                  <Sellers />
                </ProtectedRoute>
              } />
              <Route path="/upload" element={
                <ProtectedRoute>
                  <UploadFiles />
                </ProtectedRoute>
              } />
              <Route path="*" element={
                <ProtectedRoute>
                  <NotFound />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </div>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;
