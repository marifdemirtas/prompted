import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();
  
  // While checking authentication status, show a simple loading indicator
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }
  
  // If not authenticated after checking, redirect to login
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  
  // If authenticated, render the protected content
  return <Outlet />;
};

export default ProtectedRoute; 