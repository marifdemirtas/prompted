import React, { useState } from 'react';
import '../styles/ContextEditor.css';

const ContextEditor = ({ context, onContextChange, readOnly = false }) => {
  const [localContext, setLocalContext] = useState(context);
  
  const handleChange = (e) => {
    const newValue = e.target.value;
    setLocalContext(newValue);
  };
  
  const handleBlur = () => {
    if (onContextChange && localContext !== context) {
      onContextChange(localContext);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.target.blur();
    }
  };
  
  return (
    <div className="context-editor">
      <div className="context-header">
        <h3>Context Information</h3>
      </div>
      
      <div className="context-content">
        <p className="context-info">
          Paste code, problem statements, or any relevant information the AI tutor should know.
        </p>
        
        <textarea
          value={localContext}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Paste your code, assignment details, or any context here..."
          className="context-textarea"
          readOnly={readOnly}
        />
        
        <div className="context-footer">
          <span className="context-hint">Press Ctrl+Enter to save</span>
          {!readOnly && (
            <button 
              className="clear-btn"
              onClick={() => {
                setLocalContext('');
                onContextChange('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContextEditor; 