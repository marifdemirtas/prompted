import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { format } from 'date-fns';
import '../styles/ChatInterface.css';

const ChatInterface = ({ 
  messages, 
  onSendMessage, 
  loading = false, 
  readOnly = false,
  onEditMessage = null,
  onReplayFromMessage = null,
  onCancelEdit = null
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);
  const endOfMessagesRef = useRef(null);
  const inputRef = useRef(null);
  
  // Scroll to bottom when new messages come in
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  const scrollToBottom = () => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputValue.trim() && !loading && !readOnly) {
      if (isEditing && editingMessageIndex !== null) {
        // When submitting an edited message, we're creating a new conversation branch
        onSendMessage(inputValue, editingMessageIndex);
      } else {
        // Normal message send
        onSendMessage(inputValue);
      }
      setInputValue('');
      setIsTyping(false);
      setIsEditing(false);
      setEditingMessageIndex(null);
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
  const handleEditMessage = (message, index) => {
    setInputValue(message.content);
    setIsTyping(true);
    setIsEditing(true);
    setEditingMessageIndex(index);
    inputRef.current?.focus();
    
    // If onEditMessage is provided, call it
    if (onEditMessage) {
      onEditMessage(index);
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
                    {message.role === 'student' ? 'You' : 'ChatGPT'}
                  </span>
                </div>
                
                <div className="message-content">
                  {renderMessageContent(message.content)}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="message assistant loading">
                <div className="message-header">
                  <span className="role">ChatGPT</span>
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
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything"
          disabled={loading || readOnly}
          rows={1}
          className={`message-input ${isTyping ? 'typing' : ''}`}
        />
        
        <button 
          type="submit" 
          className="send-btn"
          disabled={!inputValue.trim() || loading || readOnly}
        >
          →
        </button>
      </form>
    </div>
  );
};

export default ChatInterface; 