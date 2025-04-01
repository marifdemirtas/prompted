import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../services/api';
import '../styles/ConversationsPage.css';

const ConversationsPage = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  
  useEffect(() => {
    fetchConversations();
  }, []);
  
  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await api.getConversations();
      setConversations(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError('Failed to load conversations. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDeleteConversation = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }
    
    try {
      await api.deleteConversation(id);
      setConversations(conversations.filter(convo => convo._id !== id));
    } catch (err) {
      console.error('Error deleting conversation:', err);
      alert('Failed to delete conversation. Please try again.');
    }
  };
  
  const handleStartRename = (id, title, e) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(id);
    setNewTitle(title);
  };
  
  const handleRenameConversation = async (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!newTitle.trim()) {
      return;
    }
    
    try {
      await api.updateConversation(id, { title: newTitle });
      setConversations(conversations.map(convo => 
        convo._id === id ? { ...convo, title: newTitle } : convo
      ));
      setRenamingId(null);
    } catch (err) {
      console.error('Error renaming conversation:', err);
      alert('Failed to rename conversation. Please try again.');
    }
  };
  
  const handleCancelRename = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingId(null);
  };
  
  if (loading) {
    return <div className="loading">Loading conversations...</div>;
  }
  
  if (error) {
    return <div className="error">{error}</div>;
  }
  
  if (conversations.length === 0) {
    return (
      <div className="empty-state">
        <h2>No conversations yet</h2>
        <p>Start a new chat to begin tutoring</p>
        <Link to="/" className="new-chat-button">Start New Chat</Link>
      </div>
    );
  }
  
  return (
    <div className="conversations-page">
      <h2>Your Conversations</h2>
      
      <div className="conversations-list">
        {conversations.map(conversation => (
          <div key={conversation._id} className="conversation-card">
            {renamingId === conversation._id ? (
              <div className="rename-form">
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="rename-actions">
                  <button 
                    className="save-btn"
                    onClick={(e) => handleRenameConversation(conversation._id, e)}
                  >
                    Save
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={handleCancelRename}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <Link to={`/replay/${conversation._id}`} className="conversation-link">
                <h3>{conversation.title}</h3>
                
                <div className="conversation-meta">
                  <span className="tutor-mode">
                    Mode: {conversation.metadata.llmService}
                  </span>
                  
                  <span className="timestamp">
                    {format(new Date(conversation.updatedAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
                
                <div className="message-count">
                  {conversation.messageCount || 0} messages
                </div>
              </Link>
            )}
            
            <div className="conversation-actions">
              <button 
                className="rename-btn"
                onClick={(e) => handleStartRename(conversation._id, conversation.title, e)}
                disabled={renamingId === conversation._id}
              >
                Rename
              </button>
              <button 
                className="delete-btn"
                onClick={(e) => handleDeleteConversation(conversation._id, e)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConversationsPage; 