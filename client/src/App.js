import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import ChatPage from './pages/ChatPage';
import ConversationsPage from './pages/ConversationsPage';
import ReplayPage from './pages/ReplayPage';
import './styles/App.css';

function App() {
  return (
    <div className="app">
      <Header />
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