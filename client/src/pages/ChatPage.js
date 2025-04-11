import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import LLMServiceSelector from '../components/LLMServiceSelector';
import api from '../services/api';
import '../styles/ChatPage.css';

const ChatPage = () => {
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [llmService, setLLMService] = useState(() => {
    // Initialize from localStorage if available, otherwise default to 'gemini-dialogue'
    return localStorage.getItem('lastUsedLLMService') || 'gemini-dialogue';
  });
  const [title, setTitle] = useState('New Conversation');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  
  // Save the conversation when unmounting
  useEffect(() => {
    return () => {
      if (conversationId && messages.length > 0) {
        // Store the conversation state
        localStorage.setItem('lastConversationId', conversationId);
      }
    };
  }, [conversationId, messages]);
  
  // Load the last conversation if it exists
  useEffect(() => {
    const lastConversationId = localStorage.getItem('lastConversationId');
    
    if (lastConversationId) {
      api.getConversation(lastConversationId)
        .then(response => {
          setConversationId(lastConversationId);
          setMessages(response.data.messages);
          // Handle backward compatibility with old tutor mode format
          if (response.data.metadata.tutorMode) {
            setLLMService(`gemini-${response.data.metadata.tutorMode}`);
          } else if (response.data.metadata.llmService) {
            setLLMService(response.data.metadata.llmService);
          }
          setTitle(response.data.title || 'New Conversation');
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
      // This will allow the server to generate a title based on the message and LLM service
      const response = await api.sendMessage({
        conversationId: conversationId, // This will be null for new conversations
        message,
        serviceId: llmService
      });
      
      // Update with the conversation from the server
      setConversationId(response.data.conversationId);
      setMessages(response.data.conversation.messages);
      
      // Also update the title in the UI to reflect the server-generated title
      if (response.data.conversation.title) {
        setTitle(response.data.conversation.title);
      }
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
    
    // Save to localStorage
    localStorage.setItem('lastUsedLLMService', service);
    
    // Update the LLM service in the database if we have a conversation
    if (conversationId) {
      api.updateConversation(conversationId, { 
        metadata: { llmService: service } 
      }).catch(error => console.error('Error updating LLM service:', error));
    }
  };
  
  const handleTitleChange = async () => {
    if (!title.trim()) {
      setTitle('New Conversation');
      setIsEditingTitle(false);
      return;
    }
    
    // Update the title in the database if we have a conversation
    if (conversationId) {
      try {
        await api.updateConversation(conversationId, { title });
      } catch (err) {
        console.error('Error updating title:', err);
        alert('Failed to update conversation title. Please try again.');
      }
    }
    
    setIsEditingTitle(false);
  };
  
  const handleNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setTitle('New Conversation');
    setIsEditingTitle(false);
    localStorage.removeItem('lastConversationId');
  };
  
  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="title-container">
          {isEditingTitle ? (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTitleChange();
                }
              }}
              autoFocus
              className="title-input"
            />
          ) : (
            <h2 
              className="conversation-title" 
              onClick={() => setIsEditingTitle(true)}
            >
              {title}
            </h2>
          )}
        </div>
        
        <LLMServiceSelector 
          selectedService={llmService} 
          onServiceChange={handleLLMServiceChange}
        />
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