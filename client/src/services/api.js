import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  withCredentials: true // Important for cookies/sessions
});

// Auth API methods
const login = (username) => api.post('/auth/login', { username });

const logout = () => api.post('/auth/logout');

const getCurrentUser = () => api.get('/auth/me');

// User API methods
const getUsers = () => api.get('/users');

const getUser = (id) => api.get(`/users/${id}`);

const createUser = (data) => api.post('/users', data);

const updateUser = (id, data) => api.put(`/users/${id}`, data);

const deleteUser = (id) => api.delete(`/users/${id}`);

// API methods for conversations
const getConversations = () => api.get('/conversations');

const getConversation = (id) => api.get(`/conversations/${id}`);

const createConversation = (data) => api.post('/conversations', data);

const updateConversation = (id, data) => api.put(`/conversations/${id}`, data);

const deleteConversation = (id) => api.delete(`/conversations/${id}`);

// API methods for messages
/**
 * Send a message to the LLM
 * @param {Object} data - Message data
 * @param {string} data.conversationId - ID of the conversation (optional)
 * @param {string} data.message - The message content
 * @param {string} data.serviceId - The LLM service to use (optional)
 * @returns {Promise} - The API response
 */
const sendMessage = (data) => api.post('/llm/chat', data);

/**
 * Continue a conversation with a new message
 * @param {Object} data - Message data
 * @param {string} data.conversationId - ID of the conversation
 * @param {string} data.message - The message content
 * @param {number} data.messageIndex - Index to start from (optional)
 * @param {string} data.serviceId - The LLM service to use (optional)
 * @returns {Promise} - The API response
 */
const continueConversation = (data) => api.post('/llm/continue', data);

// New method for editing a message and getting a new LLM response
const editMessage = (data) => api.post('/llm/edit', data);

const addMessage = (conversationId, data) => 
  api.post(`/conversations/${conversationId}/messages`, data);

// Direct edit of a message without LLM regeneration
const updateMessage = (conversationId, messageIndex, content) => 
  api.put(`/conversations/${conversationId}/messages/${messageIndex}`, { content });

// Fork a conversation from a specific message
const forkConversation = (conversationId, messageIndex) => 
  api.post(`/conversations/${conversationId}/fork/${messageIndex}`);

// Error handling interceptor
api.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error.response || error);
    
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      // Don't redirect if this is already an auth endpoint request
      const isAuthEndpoint = error.config.url.includes('/auth/');
      
      if (!isAuthEndpoint) {
        // Clear local storage and redirect to login page
        localStorage.removeItem('lastConversationId');
        localStorage.removeItem('lastUsedLLMService');
        
        // Redirect to login page
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default {
  // Auth methods
  login,
  logout,
  getCurrentUser,
  
  // User methods
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  
  // Conversation methods
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  
  // Message methods
  sendMessage,
  continueConversation,
  addMessage,
  editMessage,
  updateMessage,
  forkConversation
}; 