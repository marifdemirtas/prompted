import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Header.css';

const Header = () => {
  const location = useLocation();
  
  return (
    <header className="header">
      <div className="logo">
        <h1>PromptEd</h1>
        <span className="tagline">AI Tutoring for CS Education</span>
        <span className="model-badge">Powered by Gemini Flash Lite</span>
      </div>
      
      <nav className="navigation">
        <ul>
          <li className={location.pathname === '/' ? 'active' : ''}>
            <Link to="/">Chat</Link>
          </li>
          <li className={location.pathname === '/conversations' ? 'active' : ''}>
            <Link to="/conversations">History</Link>
          </li>
        </ul>
      </nav>
    </header>
  );
};

export default Header; 