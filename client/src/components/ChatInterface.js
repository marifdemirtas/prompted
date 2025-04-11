import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import { useLocation } from 'react-router-dom';
import '../styles/ChatInterface.css';

const ChatInterface = ({ 
  messages, 
  onSendMessage, 
  loading = false, 
  isLoading = false,
  isReadOnly = false,
  editingIndex = null,
  onMessageEdit = null,
  onCancelEdit = null
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(editingIndex);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  
  // Check if we're in a replay page (for different edit button text)
  const location = useLocation();
  const isReplayPage = location.pathname.includes('/replay/');
  
  // Use either loading prop for backward compatibility
  const isLoadingState = loading || isLoading;
  
  // Update editing state when prop changes
  useEffect(() => {
    if (editingIndex !== null) {
      setEditingMessageIndex(editingIndex);
      setIsEditing(true);
      // Set input value to the message being edited
      if (messages[editingIndex]) {
        setInputValue(messages[editingIndex].content);
        setIsTyping(true);
      }
    }
  }, [editingIndex, messages]);
  
  // Scroll to bottom when new messages come in
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputValue.trim() && !isLoadingState && !isReadOnly) {
      if (isEditing && editingMessageIndex !== null) {
        // When submitting an edited message
        onSendMessage(inputValue);
        setInputValue('');
        setIsTyping(false);
        setIsEditing(false);
        setEditingMessageIndex(null);
      } else {
        // Normal message send
        onSendMessage(inputValue);
        setInputValue('');
        setIsTyping(false);
      }
    }
  };
  
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape' && isEditing) {
      handleCancelEdit();
    }
  };

  // Function to handle editing a message
  const handleEditMessage = (index) => {
    if (isReadOnly || messages[index].role !== 'student') return;
    
    setInputValue(messages[index].content);
    setIsTyping(true);
    setIsEditing(true);
    setEditingMessageIndex(index);
    inputRef.current?.focus();
    
    // If onMessageEdit is provided, call it
    if (onMessageEdit) {
      onMessageEdit(index);
    }
  };
  
  // Function to handle canceling an edit
  const handleCancelEdit = () => {
    setInputValue('');
    setIsTyping(false);
    setIsEditing(false);
    setEditingMessageIndex(null);
    
    // If onCancelEdit is provided, call it
    if (onCancelEdit) {
      onCancelEdit();
    }
  };
  
  const renderMessageContent = (content) => (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter
              style={atomDark}
              language={match[1]}
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
  
  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <h3>What can I help with?</h3>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div 
                key={index} 
                className={`message ${message.role === 'student' ? 'student' : 'assistant'}`}
              >
                <div className="message-header">
                  <span className="role">
                    {message.role === 'student' ? 'You' : 'Tutor'}
                  </span>
                </div>
                
                <div className="message-content">
                  {renderMessageContent(message.content)}
                </div>
                
                {message.role === 'student' && !isReadOnly && (
                  <div className="message-actions">
                    <button 
                      className={`edit-btn ${isReplayPage ? 'fork-edit' : ''}`}
                      onClick={() => handleEditMessage(index)}
                      title={isReplayPage ? "Fork conversation and edit message" : "Edit message"}
                    >
                      {isReplayPage ? "Fork & Edit" : "Edit"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {isLoadingState && (
              <div className="message assistant loading">
                <div className="message-header">
                  <span className="role">Tutor</span>
                </div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={endOfMessagesRef} />
          </>
        )}
      </div>
      
      <form className="input-container" onSubmit={handleSubmit}>
        {isEditing && (
          <div className="editing-indicator">
            {isReplayPage ? "Forking & Editing message..." : "Editing message..."} 
            <button 
              type="button" 
              className="cancel-edit-btn" 
              onClick={handleCancelEdit}
            >
              Cancel
            </button>
          </div>
        )}
        
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={isEditing ? (isReplayPage ? "Edit message (will create a new fork)..." : "Edit your message...") : "Ask anything"}
          disabled={isLoadingState || isReadOnly}
          rows={1}
          className={`message-input ${isTyping ? 'typing' : ''}`}
        />
        
        <button 
          type="submit" 
          className={`send-btn ${isEditing && isReplayPage ? 'fork-btn' : ''}`}
          disabled={!inputValue.trim() || isLoadingState || isReadOnly}
        >
          {isEditing && isReplayPage ? 'Fork' : '→'}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface; 