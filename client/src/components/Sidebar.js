import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.getConversations();
      setConversations(response.data);
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('lastConversationId');
    console.log('New chat button clicked');
    window.location.href = '/';
  };

  const handleSelectConversation = (id) => {
    localStorage.setItem('lastConversationId', id);
    navigate(`/replay/${id}`);
  };

  const handleDeleteConversation = async (e, id) => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    try {
      await api.deleteConversation(id);
      // Remove from local state
      setConversations(conversations.filter(conv => conv._id !== id));
      // If the deleted conversation was the last active one, clear it
      if (localStorage.getItem('lastConversationId') === id) {
        localStorage.removeItem('lastConversationId');
        navigate('/');
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="sidebar open">
      <div className="sidebar-header">
        <div className="logo">
          <span>PromptEd</span>
        </div>
      </div>

      <div className="conversations-list">
        <div className="no-conversations"></div>
      </div>

      <div className="sidebar-footer">
        {currentUser && (
          <div className="user-info">
            <div className="username">
              <span>{currentUser.username}</span>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;