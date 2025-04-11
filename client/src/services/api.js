import axios from 'axios';

// Create axios instance with base URL
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api'
});

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
    
    // Customize error handling here
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default {
  getConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  sendMessage,
  continueConversation,
  addMessage,
  editMessage,
  updateMessage,
  forkConversation
}; 