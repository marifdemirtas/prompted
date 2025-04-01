import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ContextEditor from '../components/ContextEditor';
import ChatInterface from '../components/ChatInterface';
import LLMServiceSelector from '../components/LLMServiceSelector';
import api from '../services/api';
import '../styles/ReplayPage.css';

const ReplayPage = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [context, setContext] = useState('');
  const [llmService, setLLMService] = useState('gemini-dialogue');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [title, setTitle] = useState('');
  
  // Load conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const response = await api.getConversation(conversationId);
        
        setConversation(response.data);
        setMessages(response.data.messages);
        setContext(response.data.context || '');
        
        // Handle backward compatibility with old tutor mode format
        if (response.data.metadata?.tutorMode) {
          setLLMService(`gemini-${response.data.metadata.tutorMode}`);
        } else if (response.data.metadata?.llmService) {
          setLLMService(response.data.metadata.llmService);
        }
        
        setTitle(response.data.title || 'New Conversation');
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
  
  const handleContextChange = async (newContext) => {
    setContext(newContext);
    
    try {
      await api.updateConversation(conversationId, { context: newContext });
    } catch (err) {
      console.error('Error updating context:', err);
    }
  };
  
  const handleLLMServiceChange = async (service) => {
    setLLMService(service);
    
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
  
  const handleTitleChange = async () => {
    if (!title.trim()) {
      setTitle(conversation.title);
      setIsEditingTitle(false);
      return;
    }
    
    try {
      await api.updateConversation(conversationId, { title });
      // Update the conversation object with the new title
      setConversation({ ...conversation, title });
      setIsEditingTitle(false);
    } catch (err) {
      console.error('Error updating title:', err);
    }
  };
  
  const resetView = () => {
    setEditingMessageIndex(null);
  };
  
  const handleStartEditing = (messageIndex) => {
    setEditingMessageIndex(messageIndex);
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
          context,
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
      <div className="sidebar">
        <div className="replay-controls">
          <div className="conversation-title-container">
            {isEditingTitle ? (
              <div className="title-edit-form">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleChange}
                  autoFocus
                  className="title-input"
                />
                <div className="title-actions">
                  <button 
                    className="save-btn" 
                    onClick={handleTitleChange}
                  >
                    Save
                  </button>
                  <button 
                    className="cancel-btn" 
                    onClick={() => {
                      setIsEditingTitle(false);
                      setTitle(conversation.title);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="conversation-title">
                <h3>{title}</h3>
                <button 
                  className="edit-title-btn" 
                  onClick={() => setIsEditingTitle(true)}
                  aria-label="Edit title"
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
          
          <button 
            className="back-btn" 
            onClick={() => navigate('/conversations')}
          >
            Back to Conversations
          </button>
        </div>
        
        <ContextEditor 
          context={context} 
          onContextChange={handleContextChange}
        />
        
        <LLMServiceSelector 
          selectedService={llmService} 
          onSelectService={handleLLMServiceChange}
          conversationId={conversationId}
          isForking={editingMessageIndex !== null}
        />
      </div>
      
      <div className="chat-container">
        {editingMessageIndex !== null && (
          <div className="forking-message">
            You are creating a fork from message #{editingMessageIndex + 1}. 
            You can now change the LLM service for this fork.
          </div>
        )}
        <ChatInterface 
          messages={messages} 
          onSendMessage={handleSendMessage}
          loading={loading}
          readOnly={false}
          onEditMessage={handleStartEditing}
          onCancelEdit={resetView}
        />
      </div>
    </div>
  );
};

export default ReplayPage; 