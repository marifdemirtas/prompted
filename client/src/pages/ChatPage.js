import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import ChatInterface from '../components/ChatInterface';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/ChatPage.css';

const ChatPage = () => {
  const { conversationId: paramConversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isReplayMode = location.pathname.includes('/replay/');
  
  const defaultGreeting = { role: 'system', content: 'Hi there! I\'m your AI tutor—I\'m here to help you learn computer science today, so feel free to ask questions or jump right into a problem when you\'re ready!' };

  const [messages, setMessages] = useState(paramConversationId? [] : [defaultGreeting]);
  const [conversation, setConversation] = useState(null);
  const [conversationId, setConversationId] = useState(paramConversationId || null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(isReplayMode);
  const [llmService, setLLMService] = useState(null);
  const [isLLMDropdownOpen, setIsLLMDropdownOpen] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();
  const dropdownRef = useRef(null);
  
  // Initialize LLM service when user changes
  useEffect(() => {
    if (currentUser && !isReplayMode) {
      // Initialize from user default service
      setLLMService(currentUser.defaultService);
      localStorage.setItem('lastUsedLLMService', currentUser.defaultService);
    }
  }, [currentUser, isReplayMode]);
  
  // Update conversationId when URL param changes
  useEffect(() => {
    setConversationId(paramConversationId || null);
  }, [paramConversationId]);
  
  // Persist the conversationId when it changes for non-replay mode
  useEffect(() => {
    if (!isReplayMode && conversationId) {
      localStorage.setItem('lastConversationId', conversationId);
    }
  }, [conversationId, isReplayMode]);
  
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
  
  // Load conversation - either from replay or last conversation
  useEffect(() => {
    const loadConversation = async () => {
      try {
        setLoading(true);
        const response = await api.getConversation(conversationId);
        
        setConversation(response.data);
        setMessages(response.data.messages || [defaultGreeting]);
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
    
    if (isReplayMode && conversationId) {
      loadConversation();
    } else if (!isReplayMode && !conversationId) {
      const lastConversationId = localStorage.getItem('lastConversationId');
      if (lastConversationId) {
        api.getConversation(lastConversationId)
          .then(response => {
            setConversationId(lastConversationId);
            setMessages(response.data.messages || [defaultGreeting]);
            if (response.data.metadata && response.data.metadata.llmService) {
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
      } else {
        // No previous conversation, clear chat state
        setMessages([defaultGreeting]);
        setConversation(null);
        setEditingMessageIndex(null);
        setError(null);
        setLoading(false);
      }
    }
  }, [conversationId, isReplayMode, currentUser]);
  
  const resetView = () => {
    setEditingMessageIndex(null);
  };
  
  const handleEditMessage = (index) => {
    setEditingMessageIndex(index);
  };
  
  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
  };

  const handleLLMServiceChange = async (service) => {
    setLLMService(service);
    setIsLLMDropdownOpen(false);
    
    if (!isReplayMode) {
      localStorage.setItem('lastUsedLLMService', service);
    }
    
    // Update the LLM service in the database if we have a conversation
    if (conversationId) {
      try {
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
      } catch (error) {
        console.error('Error updating LLM service:', error);
      }
    }
  };
  
  const handleSendMessage = async (message) => {
    if (!message.trim()) return;
    
    // If in replay mode and editing a message
    if (isReplayMode && editingMessageIndex !== null) {
      try {
        setLoading(true);
        
        // Step 1: Fork the conversation at this message index without modifying the original
        console.log('Forking conversation:', conversationId, 'at index:', editingMessageIndex);
        const response = await api.forkConversation(conversationId, editingMessageIndex);
        
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
        setLoading(false);
        alert(`Failed to fork conversation: ${forkError.message}`);
        return;
      }
    }
    
    // If in chat mode and editing a message
    else if (!isReplayMode && editingMessageIndex !== null) {
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
    
    // Regular message send (for both modes)
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
      if (isReplayMode) {
        setMessages(response.data.conversation.messages);
        // Update conversation data
        setConversation(response.data.conversation);
      } else {
        setConversationId(response.data.conversationId);
        setMessages(response.data.conversation.messages);
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

  // Get available LLM services
  const llmServices = (currentUser?.allowedServices?.map(serviceId => {
    const [provider, mode] = serviceId.split('-');

    let lookupTable = {
      "gemini-direct": "Alpha Tutor",
      "gemini-explanation": "Gamma Tutor",
      "gemini-scaffolding": "Omega Tutor"
    }

    const label = lookupTable[serviceId] || serviceId;
    
    return {
      id: serviceId,
      label
    };
  }) || []);
  
  // Find the current service label
  const currentService = llmService ? 
    llmServices.find(service => service.id === llmService) || { label: 'LLM Service' } :
    { label: 'Select Service' };
  
    console.log("currentService", currentService);
    console.log("currentService", currentService.label);


  if (isReplayMode && error) {
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
    <div className={isReplayMode ? "replay-page" : "chat-page"}>

      {isReplayMode && editingMessageIndex !== null && (
        <div className="top-bar">
          <div className="fork-mode-indicator">
            Fork Mode: Creating a new conversation branch
          </div>
        </div>
      )}

      
      <div className={isReplayMode ? "replay-container" : "chat-container"}>
        
          <ChatInterface
            messages={messages}
            isReadOnly={false}
            editingIndex={editingMessageIndex}
            onMessageEdit={isReplayMode ? handleEditMessage : handleEditMessage}
            onSendMessage={handleSendMessage}
            onCancelEdit={isReplayMode ? resetView : handleCancelEdit}
            loading={loading}
          />
      </div>
    </div>
  );
};

export default ChatPage; 