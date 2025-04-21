import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

// Create the auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Check if user is logged in on initial load
  useEffect(() => {
    const fetchCurrentUser = async () => {
      // Prevent multiple fetches
      if (authChecked) return;
      
      try {
        const response = await api.getCurrentUser();
        setCurrentUser(response.data);
      } catch (error) {
        // Not logged in or session expired
        setCurrentUser(null);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };

    fetchCurrentUser();
  }, [authChecked]);

  // Login function
  const login = async (username) => {
    try {
      setError(null);
      const response = await api.login(username);
      setCurrentUser(response.data);
      setAuthChecked(true);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Login failed');
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear user state and storage
      setCurrentUser(null);
      localStorage.removeItem('lastConversationId');
      localStorage.removeItem('lastUsedLLMService');
      setAuthChecked(false); // Allow re-checking auth on next login
    }
  };

  const value = {
    currentUser,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!currentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 