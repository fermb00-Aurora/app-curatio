import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type AuthContextType = {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  
  // Check localStorage on initial load
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const login = async (email: string, password: string) => {
    console.log("AuthContext: login called with email:", email);
    // Simulate API call with timeout
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      setTimeout(() => {
        if (email === 'ovidalreig@gmail.com' && password === 'OviFer123') {
          localStorage.setItem('isAuthenticated', 'true');
          setIsAuthenticated(true);
          console.log("AuthContext: login success, setting isAuthenticated true");
          resolve({ success: true });
        } else {
          console.error("AuthContext: login failed for email:", email);
          resolve({ success: false, error: 'Invalid email or password. Please try again.' });
        }
      }, 800);
    });
  };

  const logout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}; 