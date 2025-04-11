import React, { useState, useEffect, useRef } from 'react';
import ChatInterface from '../components/ChatInterface';
import api from '../services/api';
import '../styles/ChatPage.css';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [llmService, setLLMService] = useState(() => {
    // Initialize from localStorage if available, otherwise default to 'gemini-dialogue'
    return localStorage.getItem('lastUsedLLMService') || 'gemini-direct';
  });
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
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
            setLLMService(response.data.metadata.llmService);
          }
        })
        .catch(error => {
          console.error('Error loading last conversation:', error);
        });
    }
  }, []);
  
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    
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
  
  const llmServices = [
    {
      id: 'gemini-direct',
      label: 'Gemini Direct'
    },
    {
      id: 'gemini-explanation',
      label: 'Gemini Explanation'
    },
    {
      id: 'gemini-dialogue',
      label: 'Gemini Dialogue'
    },
    {
      id: 'gemini-scaffolding',
      label: 'Gemini Scaffolding'
    },
  ];
  
  // Find the current service label
  const currentService = llmServices.find(service => service.id === llmService) || { label: 'LLM Service' };
  
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
          isLoading={loading}
        />
      </div>
    </div>
  );
};

export default ChatPage; 