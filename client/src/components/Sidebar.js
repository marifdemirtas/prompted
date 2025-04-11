import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/Sidebar.css';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
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
    navigate('/');
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

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        <div className="logo">
          <span>ChatGPT</span>
        </div>
        <button className="new-chat-btn" onClick={handleNewChat}>
          <span>+ New chat</span>
        </button>
      </div>

      <div className="conversations-list">
        {loading ? (
          <div className="loading-spinner">Loading...</div>
        ) : (
          <div className="conversation-items">
            {conversations.map(conversation => (
              <div
                key={conversation._id}
                className="conversation-item"
                onClick={() => handleSelectConversation(conversation._id)}
              >
                <span className="conversation-title">{conversation.title}</span>
                <button 
                  className="delete-conversation-btn"
                  onClick={(e) => handleDeleteConversation(e, conversation._id)}
                  title="Delete conversation"
                >
                  <span>×</span>
                </button>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="no-conversations">No conversations yet</div>
            )}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
      </div>
    </div>
  );
};

export default Sidebar; 