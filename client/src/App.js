import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import ConversationsPage from './pages/ConversationsPage';
import ReplayPage from './pages/ReplayPage';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import './styles/App.css';

function App() {
  return (
    <AuthProvider>
      <div className="app">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route 
              path="/" 
              element={
                <>
                  <Sidebar />
                  <main className="main-content">
                    <ChatPage />
                  </main>
                </>
              } 
            />
            <Route 
              path="/conversations" 
              element={
                <>
                  <Sidebar />
                  <main className="main-content">
                    <ConversationsPage />
                  </main>
                </>
              } 
            />
            <Route 
              path="/replay/:conversationId" 
              element={
                <>
                  <Sidebar />
                  <main className="main-content">
                    <ReplayPage />
                  </main>
                </>
              } 
            />
          </Route>
          
          {/* Redirect any unknown routes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}

export default App; 