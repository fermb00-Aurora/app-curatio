
import React, { createContext, useState, useContext, useEffect } from "react";
import { useTranslation } from "react-i18next";

// Define the types for our app state
type DateRange = {
  startDate: Date;
  endDate: Date;
  label?: string;
};

type AppState = {
  language: "es" | "en";
  dateRange: DateRange;
  currentDateTime: Date;
};

type AppContextType = {
  state: AppState;
  setLanguage: (language: "es" | "en") => void;
  setDateRange: (dateRange: DateRange) => void;
  updateCurrentDateTime: () => void;
};

// Default date range (today)
const today = new Date();
const defaultDateRange: DateRange = {
  startDate: today,
  endDate: today,
  label: "Hoy",
};

// Initial state for the context
const initialState: AppState = {
  language: "es",
  dateRange: defaultDateRange,
  currentDateTime: new Date(),
};

// Create the context
const AppContext = createContext<AppContextType | undefined>(undefined);

// Create a provider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const { i18n } = useTranslation();

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      updateCurrentDateTime();
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Initialize date and time
  useEffect(() => {
    updateCurrentDateTime();
    
    // Set initial language from browser or localStorage if available
    const savedLanguage = localStorage.getItem("language");
    if (savedLanguage === "es" || savedLanguage === "en") {
      setLanguage(savedLanguage);
    }
  }, []);
  
  // Sync i18n language with our app state
  useEffect(() => {
    i18n.changeLanguage(state.language);
    localStorage.setItem("language", state.language);
  }, [state.language, i18n]);

  const setLanguage = (language: "es" | "en") => {
    setState((prev) => ({ ...prev, language }));
  };

  const setDateRange = (dateRange: DateRange) => {
    setState((prev) => ({ ...prev, dateRange }));
  };

  const updateCurrentDateTime = () => {
    setState((prev) => ({ ...prev, currentDateTime: new Date() }));
  };

  return (
    <AppContext.Provider value={{ state, setLanguage, setDateRange, updateCurrentDateTime }}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook to use the app context
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
