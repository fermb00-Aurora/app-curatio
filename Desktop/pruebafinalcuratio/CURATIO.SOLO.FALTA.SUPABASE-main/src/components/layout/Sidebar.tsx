import React from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { useDataContext } from "@/contexts/DataContext";
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

interface SidebarProps {
  onDateRangeChange?: (range: { from: Date; to: Date }) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onDateRangeChange }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { state, setLanguage } = useAppContext();
  const { setDateRange, dateRange } = useDataContext();
  const { logout } = useAuth();

  const toggleLanguage = () => {
    const newLanguage = state.language === "es" ? "en" : "es";
    setLanguage(newLanguage);
    console.log("Language changed to:", newLanguage);
  };

  const navigationItems = [
    {
      name: t("navigation.dashboard"),
      href: "/",
      icon: ChartBarIcon,
    },
    {
      name: t("navigation.transactions"),
      href: "/transactions",
      icon: CurrencyEuroIcon,
    },
    {
      name: t("navigation.products"),
      href: "/products",
      icon: ShoppingBagIcon,
    },
    {
      name: t("navigation.sellers"),
      href: "/sellers",
      icon: UserGroupIcon,
    },
    {
      name: t("navigation.uploadFiles"),
      href: "/upload",
      icon: ArrowUpTrayIcon,
    },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const handleDateRangeChange = (range: { from: Date; to: Date }) => {
    console.log(`Sidebar date range changed: ${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`);
    
    setDateRange(range.from, range.to);
    
    if (onDateRangeChange) {
      onDateRangeChange(range);
    }
  };

  const openWhatsAppSupport = () => {
    window.open(`https://wa.me/34654659052`, '_blank');
  };

  return (
    <aside className="w-60 min-h-screen bg-[#2A3547] text-white flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-white">
          Curatio
        </h1>
        <p className="text-sm text-gray-400 uppercase tracking-wider">
          by Mallorana
        </p>
      </div>

      <div className="px-4 py-4 border-t border-gray-700">
        <h3 className="text-sm font-medium mb-3 text-white">
          {t("navigation.selectDate")}
        </h3>
        <DateRangeSelector onChange={handleDateRangeChange} />
      </div>

      <nav className="flex-1 mt-6">
        <ul>
          {navigationItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`flex items-center px-6 py-3 text-sm ${
                  isActive(item.href)
                    ? "bg-[#334155] text-white"
                    : "text-gray-400 hover:bg-[#334155] hover:text-white"
                }`}
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-6 py-4 border-t border-gray-700 flex flex-col space-y-4">
        <button
          onClick={openWhatsAppSupport}
          className="flex items-center text-sm text-green-400 hover:text-green-300 transition-colors"
        >
          <MessageCircleIcon className="h-5 w-5 mr-2" />
          {t("navigation.support")}
        </button>
        
        <button
          onClick={toggleLanguage}
          className="flex items-center text-sm text-gray-400 hover:text-white"
        >
          <LanguageIcon className="h-5 w-5 mr-2" />
          {t("navigation.language")}
        </button>
        
        <button
          onClick={logout}
          className="flex items-center text-sm text-red-400 hover:text-red-300"
        >
          <LogOut className="h-5 w-5 mr-2" />
          {t("navigation.logout", "Logout")}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
