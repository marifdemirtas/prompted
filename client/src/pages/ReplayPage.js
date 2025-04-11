import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import api from '../services/api';
import '../styles/ReplayPage.css';

const ReplayPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [llmService, setLLMService] = useState('gemini-dialogue');
  const [error, setError] = useState(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
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
  
  // Load conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const response = await api.getConversation(conversationId);
        
        setConversation(response.data);
        setMessages(response.data.messages || []);
        setTitle(response.data.title || 'Conversation');
        
        // Handle backward compatibility with old tutor mode format
        if (response.data.metadata?.tutorMode) {
          setLLMService(`gemini-${response.data.metadata.tutorMode}`);
        } else if (response.data.metadata?.llmService) {
          setLLMService(response.data.metadata.llmService);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error fetching conversation:', err);
        setError('Failed to load conversation. It may have been deleted or does not exist.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchConversation();
  }, [conversationId]);
  
  const resetView = () => {
    setEditingMessageIndex(null);
  };
  
  const handleStartEditing = (messageIndex) => {
    setEditingMessageIndex(messageIndex);
  };
  
  const handleLLMServiceChange = async (service) => {
    setLLMService(service);
    setIsLLMDropdownOpen(false);
    
    try {
      // Update only the llmService field without referencing the conversation's metadata object
      await api.updateConversation(conversationId, {
        metadata: { llmService: service }
      });
      
      // Update local state to reflect the change
      if (conversation) {
        setConversation({
          ...conversation,
          metadata: {
            ...conversation.metadata,
            llmService: service
          }
        });
      }
    } catch (err) {
      console.error('Error updating LLM service:', err);
    }
  };
  
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    setLoading(true);
    
    try {
      let response;
      
      if (editingMessageIndex !== null) {
        try {
          // Step 1: Fork the conversation at this message index without modifying the original
          console.log('Forking conversation:', conversationId, 'at index:', editingMessageIndex);
          response = await api.forkConversation(conversationId, editingMessageIndex);
          
          // Step 2: Get the new conversation ID
          const forkedConversationId = response.data._id;
          console.log('Created forked conversation with ID:', forkedConversationId);
          
          // Step 3: Get the forked conversation to confirm its structure
          const forkedConversation = await api.getConversation(forkedConversationId);
          console.log('Retrieved forked conversation:', forkedConversation.data);
          
          // Step 4: Update the last message instead of adding a new one
          const lastMessageIndex = forkedConversation.data.messages.length - 1;
          console.log('Updating message at index:', lastMessageIndex);
          await api.updateMessage(forkedConversationId, lastMessageIndex, message);
          
          // Step 5: Update the LLM service in the new conversation
          console.log('Updating LLM service to:', llmService);
          await api.updateConversation(forkedConversationId, {
            metadata: { llmService: llmService }
          });
          
          // Step 6: Generate AI response in the new conversation
          console.log('Generating AI response with service:', llmService);
          await api.continueConversation({
            conversationId: forkedConversationId,
            serviceId: llmService
          });
          
          // Step 7: Navigate to the new forked conversation
          console.log('Navigating to forked conversation');
          navigate(`/replay/${forkedConversationId}`);
          return; // Exit early since we've navigated away
        } catch (forkError) {
          console.error('Specific forking error:', forkError);
          throw new Error(`Failed to fork conversation: ${forkError.message}`);
        }
      } else {
        // Sending a new message
        response = await api.sendMessage({
          conversationId,
          message,
          serviceId: llmService
        });
        
        // Update with the conversation from the server
        setMessages(response.data.conversation.messages);
        // Update conversation data
        setConversation(response.data.conversation);
      }
    } catch (err) {
      console.error('Error sending or forking message:', err);
      alert(`Failed to save or fork. ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
      setEditingMessageIndex(null);
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
  
  if (loading && !conversation) {
    return <div className="loading">Loading conversation...</div>;
  }
  
  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button onClick={() => navigate('/conversations')} className="back-btn">
          Back to Conversations
        </button>
      </div>
    );
  }
  
  return (
    <div className="replay-page">
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
        
        {editingMessageIndex !== null && (
          <div className="fork-mode-indicator">
            Fork Mode: Creating a new conversation branch
          </div>
        )}
      </div>
      
      <div className="replay-container">
        {loading ? (
          <div className="loading">Loading conversation...</div>
        ) : (
          <ChatInterface
            messages={messages}
            isReadOnly={false}
            editingIndex={editingMessageIndex}
            onMessageEdit={handleStartEditing}
            onSendMessage={handleSendMessage}
            onCancelEdit={resetView}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default ReplayPage; 