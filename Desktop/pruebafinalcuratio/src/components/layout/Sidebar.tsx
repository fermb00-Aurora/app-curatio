import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { useData } from "@/contexts/DataContext";
import { useAuth } from "@/contexts/AuthContext";
import { DateRangeSelector } from "../common/DateRangeSelector";
import {
  ChartBarIcon,
  CurrencyEuroIcon,
  ShoppingBagIcon,
  UserGroupIcon,
  ArrowUpTrayIcon,
  LanguageIcon,
} from "@heroicons/react/24/outline";
import { MessageCircleIcon, LogOut } from "lucide-react";

const Sidebar = () => {
  const location = useLocation();
  const { state, setLanguage } = useAppContext();
  const { setDateRange } = useData();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <div className="flex flex-col h-full bg-white border-r">
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">Curatio</h1>
        <nav className="space-y-2">
          <Link
            to="/"
            className={`block px-4 py-2 rounded ${
              location.pathname === "/" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Dashboard
          </Link>
          <Link
            to="/transactions"
            className={`block px-4 py-2 rounded ${
              location.pathname === "/transactions" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Transacciones
          </Link>
          <Link
            to="/products"
            className={`block px-4 py-2 rounded ${
              location.pathname === "/products" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Productos
          </Link>
          <Link
            to="/upload"
            className={`block px-4 py-2 rounded ${
              location.pathname === "/upload" ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            Subir Archivos
          </Link>
        </nav>
      </div>

      <div className="p-4 mt-auto">
        <div className="mb-4">
          <DateRangeSelector />
        </div>
        <button
          onClick={handleLogout}
          className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 rounded"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
