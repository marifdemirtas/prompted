import React, { useState } from 'react';
import '../styles/TutorModeSelector.css';

const TutorModeSelector = ({ selectedMode, onSelectMode, disabled = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const tutorModes = [
    {
      id: 'direct',
      label: 'Direct Answer',
      description: 'Provides concise, direct answers without additional explanation.'
    },
    {
      id: 'explanation',
      label: 'Explanation',
      description: 'Gives detailed explanations with examples to teach concepts.'
    },
    {
      id: 'dialogue',
      label: 'Dialogue',
      description: 'Uses Socratic dialogue with questions to foster understanding.'
    },
    {
      id: 'scaffolding',
      label: 'Scaffolding',
      description: 'Breaks problems into steps and provides hints rather than answers.'
    }
  ];
  
  const handleModeChange = (mode) => {
    if (!disabled && onSelectMode) {
      onSelectMode(mode);
    }
  };
  
  return (
    <div className="tutor-mode-selector">
      <div className="selector-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Tutoring Mode</h3>
        <button className="toggle-btn">
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="mode-options">
          {tutorModes.map(mode => (
            <div 
              key={mode.id}
              className={`mode-option ${selectedMode === mode.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => handleModeChange(mode.id)}
            >
              <div className="mode-label">
                <input 
                  type="radio" 
                  name="tutorMode" 
                  value={mode.id} 
                  checked={selectedMode === mode.id}
                  onChange={() => {}}
                  disabled={disabled}
                />
                <span>{mode.label}</span>
              </div>
              <p className="mode-description">{mode.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TutorModeSelector; 