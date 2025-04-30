import React, { useState, useEffect } from 'react';
import '../styles/LLMServiceSelector.css';

const LLMServiceSelector = ({ 
  selectedService, 
  onSelectService, 
  disabled = false, 
  conversationId = null,
  isForking = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // For debug
  useEffect(() => {
    console.log('LLMServiceSelector props:', { 
      selectedService, 
      disabled, 
      conversationId,
      isForking,
      isLocked: (conversationId !== null && !isForking) || disabled
    });
  }, [selectedService, disabled, conversationId, isForking]);
  
  // Determine if the selector should be locked:
  // - It should be locked if there's a conversation (conversationId exists) AND we're not in forking mode
  // - It should respect the disabled prop as well
  const isLocked = (conversationId !== null && !isForking) || disabled;
  
  const llmServices = [
    {
      id: 'gemini-direct',
      label: 'Alpha',
      description: 'Alpha Tutor provides concise, direct answers without additional explanation.'
    },
    {
      id: 'gemini-explanation',
      label: 'Gamma',
      description: 'Gamma Tutor provides detailed explanations with examples to teach concepts.'
    },
    {
      id: 'gemini-scaffolding',
      label: 'Omega',
      description: 'Omega Tutor breaks problems into steps and provides hints rather than answers.'
    },
    {
      id: 'openai-direct',
      label: 'OpenAI Direct',
      description: 'OpenAI Direct provides concise, direct answers without explanation.'
    },
    {
      id: 'openai-explanation',
      label: 'OpenAI Explanatory',
      description: 'OpenAI Explanatory provides detailed explanations with examples.'
    },
    {
      id: 'openai-scaffolding',
      label: 'OpenAI Scaffolding',
      description: 'OpenAI Scaffolding breaks problems into steps with guided hints.'
    }
  ];
  
  const handleServiceChange = (service) => {
    if (!isLocked && onSelectService) {
      console.log('Changing LLM service to:', service);
      onSelectService(service);
    } else {
      console.log('Service change blocked. isLocked:', isLocked);
    }
  };
  
  return (
    <div className={`llm-service-selector ${isForking ? 'forking' : ''}`}>
      <div className="selector-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>
          LLM Service
          {isForking && <span className="forking-indicator">Forking</span>}
          {isLocked && !isForking && <span className="locked-indicator">Locked</span>}
        </h3>
        <button className="toggle-btn">
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="service-options">
          {isLocked && (
            <div className="service-locked-message">
              The LLM service cannot be changed after starting a conversation. 
              You can change it when forking the conversation.
            </div>
          )}
          {isForking && (
            <div className="service-forking-message">
              You can now select a different LLM service for this forked conversation.
            </div>
          )}
          {llmServices.map(service => (
            <div 
              key={service.id}
              className={`service-option ${selectedService === service.id ? 'selected' : ''} ${isLocked ? 'disabled' : ''}`}
              onClick={() => handleServiceChange(service.id)}
            >
              <div className="service-label">
                <input 
                  type="radio" 
                  name="llmService" 
                  value={service.id} 
                  checked={selectedService === service.id}
                  onChange={() => {}}
                  disabled={isLocked}
                />
                <span>{service.label}</span>
              </div>
              <p className="service-description">{service.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LLMServiceSelector; 