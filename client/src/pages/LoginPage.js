import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/LoginPage.css';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser, login } = useAuth();

  // If already authenticated, redirect to home
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await login(username.trim());
      navigate('/');
    } catch (error) {
      console.error('Login error:', error);
      if (error.response && error.response.status === 404) {
        setError('User not found. Available users: admin, student1, student2');
      } else {
        setError('Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>PromptEd</h1>
          <p>AI Tutoring for Computer Science</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username (admin, student1, student2)"
              disabled={loading}
              autoComplete="off"
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>
        
        <div className="help-text">
          <p>Use one of the default usernames created by the database initialization script:</p>
          <ul>
            <li><strong>admin</strong> - access to all LLM services</li>
            <li><strong>student1</strong> - dialogue and explanation services</li>
            <li><strong>student2</strong> - direct and explanation services</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginPage; 