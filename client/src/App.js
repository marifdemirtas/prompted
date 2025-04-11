import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ChatPage from './pages/ChatPage';
import ConversationsPage from './pages/ConversationsPage';
import ReplayPage from './pages/ReplayPage';
import './styles/App.css';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="app">
      <Sidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/replay/:conversationId" element={<ReplayPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App; 