import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from '../components/ChatInterface';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/ChatPage.css';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [llmService, setLLMService] = useState(null);
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const { currentUser } = useAuth();
  const dropdownRef = useRef(null);
  
  // Initialize LLM service when user changes
  useEffect(() => {
    if (currentUser) {
      // Initialize from user default service
      setLLMService(currentUser.defaultService);
      localStorage.setItem('lastUsedLLMService', currentUser.defaultService);
    }
  }, [currentUser]);
  
  // Save the conversation when unmounting
  useEffect(() => {
    return () => {
      if (conversationId && messages.length > 0) {
        // Store the conversation state
        localStorage.setItem('lastConversationId', conversationId);
      }
    };
  }, [conversationId, messages]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsLLMDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);
  
  // Load the last conversation if it exists
  useEffect(() => {
    const lastConversationId = localStorage.getItem('lastConversationId');
    
    if (lastConversationId) {
      api.getConversation(lastConversationId)
        .then(response => {
          setConversationId(lastConversationId);
          setMessages(response.data.messages);
          if (response.data.metadata.llmService) {
            // Only set if the service is allowed for this user
            if (currentUser && currentUser.allowedServices.includes(response.data.metadata.llmService)) {
              setLLMService(response.data.metadata.llmService);
            }
          }
        })
        .catch(error => {
          console.error('Error loading last conversation:', error);
          // Clear invalid conversation ID
          localStorage.removeItem('lastConversationId');
        });
    }
  }, [currentUser]);
  
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    
    // If editing a message
    if (editingMessageIndex !== null) {
      try {
        setLoading(true);
        
        const response = await api.editMessage({
          conversationId: conversationId,
          messageIndex: editingMessageIndex,
          newContent: message,
          serviceId: llmService
        });
        
        // Update the conversation
        setMessages(response.data.conversation.messages);
        setEditingMessageIndex(null);
      } catch (error) {
        console.error('Error editing message:', error);
        alert('Failed to edit message. Please try again.');
      } finally {
        setLoading(false);
      }
      return;
    }
    
    // Regular message send
    // Add user message to the UI immediately
    setMessages(prev => [...prev, { role: 'student', content: message }]);
    setLoading(true);
    
    try {
      // Send the message directly, letting the LLM/chat endpoint handle conversation creation
      const response = await api.sendMessage({
        conversationId: conversationId,
        message,
        serviceId: llmService
      });
      
      // Update with the conversation from the server
      setConversationId(response.data.conversationId);
      setMessages(response.data.conversation.messages);
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove the user message if there was an error
      setMessages(prev => prev.slice(0, -1));
      alert('Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMessage = (index) => {
    setEditingMessageIndex(index);
  };
  
  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
  };

  const handleLLMServiceChange = (service) => {
    setLLMService(service);
    localStorage.setItem('lastUsedLLMService', service);
    setIsLLMDropdownOpen(false);
    
    // Update the LLM service in the database if we have a conversation
    if (conversationId) {
      api.updateConversation(conversationId, { 
        metadata: { llmService: service } 
      }).catch(error => console.error('Error updating LLM service:', error));
    }
  };
  
  // Get available LLM services from user's allowed services
  const llmServices = currentUser?.allowedServices?.map(serviceId => {
    const [provider, mode] = serviceId.split('-');
    const label = `${provider.charAt(0).toUpperCase() + provider.slice(1)} ${mode.charAt(0).toUpperCase() + mode.slice(1)}`;
    
    return {
      id: serviceId,
      label
    };
  }) || [];
  
  // Find the current service label
  const currentService = llmService ? 
    llmServices.find(service => service.id === llmService) || { label: 'LLM Service' } :
    { label: 'Select Service' };
  
  return (
    <div className="chat-page">
      <div className="top-bar">
        <div className="llm-service-dropdown" ref={dropdownRef}>
          <button 
            className="llm-service-btn" 
            onClick={() => setIsLLMDropdownOpen(!isLLMDropdownOpen)}
          >
            {currentService.label} <span className="plus-icon">+</span>
          </button>
          
          {isLLMDropdownOpen && (
            <div className="llm-dropdown-menu">
              {llmServices.map(service => (
                <div 
                  key={service.id}
                  className={`llm-dropdown-item ${service.id === llmService ? 'selected' : ''}`}
                  onClick={() => handleLLMServiceChange(service.id)}
                >
                  {service.label}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="chat-container">
        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={loading}
          editingIndex={editingMessageIndex}
          onMessageEdit={handleEditMessage}
          onCancelEdit={handleCancelEdit}
        />
      </div>
    </div>
  );
};

export default ChatPage; 