const express = require('express');
const router = express.Router();
const { generateLLMResponse } = require('../services/llmService');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Helper function to check if a service is allowed for the user
async function isServiceAllowedForUser(userId, serviceId) {
  try {
    const user = await User.findById(userId);
    if (!user) return false;
    
    return user.allowedServices.includes(serviceId);
  } catch (error) {
    console.error('Error checking allowed services:', error);
    return false;
  }
}

// Helper function to get a user's default service
async function getUserDefaultService(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return 'gemini-dialogue'; // Fallback default
    
    return user.defaultService;
  } catch (error) {
    console.error('Error getting user default service:', error);
    return 'gemini-dialogue'; // Fallback default
  }
}

// Process a message and get LLM response
router.post('/chat', async (req, res) => {
  try {
    const { conversationId, message, serviceId } = req.body;
    const userId = req.session.userId;
    
    if (!message) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    let conversation;
    let selectedServiceId = serviceId;
    
    // Check if the requested service is allowed for this user
    if (selectedServiceId) {
      const isAllowed = await isServiceAllowedForUser(userId, selectedServiceId);
      
      if (!isAllowed) {
        // If not allowed, fall back to user's default service
        const defaultService = await getUserDefaultService(userId);
        selectedServiceId = defaultService;
      }
    } else {
      // If no service specified, use user's default
      selectedServiceId = await getUserDefaultService(userId);
    }
    
    // Find or create conversation
    if (conversationId) {
      conversation = await Conversation.findOne({ 
        _id: conversationId, 
        user: userId 
      });
      
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // If a different serviceId is provided, update the conversation's metadata
      if (selectedServiceId && selectedServiceId !== conversation.metadata.llmService) {
        // Create a deep copy of metadata and update it
        const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
        updatedMetadata.llmService = selectedServiceId;
        
        // For backward compatibility, also update tutorMode if the service follows the expected format
        const [provider, mode] = selectedServiceId.split('-');
        if (provider === 'gemini' && mode) {
          updatedMetadata.tutorMode = mode;
        }
        
        // Set the updated metadata
        conversation.metadata = updatedMetadata;
      }
    } else {
      // Get the service name to use in the title
      const serviceFormatted = selectedServiceId.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      
      const titlePrefix = `[${serviceFormatted}] `;
      const maxQueryLength = 100 - titlePrefix.length;
      const truncatedMessage = message.length > maxQueryLength 
        ? message.substring(0, maxQueryLength - 3) + '...' 
        : message;
      
      const title = titlePrefix + truncatedMessage;
      
      // Create a new conversation
      conversation = new Conversation({
        title: title,
        messages: [],
        user: userId,
        metadata: {
          // For backward compatibility, store both tutorMode and llmService
          tutorMode: selectedServiceId.split('-')[1] || 'dialogue',
          llmService: selectedServiceId
        }
      });
      
      await conversation.save();
    }
    
    // Add user message to conversation
    conversation.messages.push({
      role: 'student',
      content: message
    });
    
    // Generate LLM response
    const promptData = {
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      // Use conversation's stored service
      serviceId: conversation.metadata.llmService
    };
    
    const llmResponse = await generateLLMResponse(promptData);
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: llmResponse
    });
    
    await conversation.save();
    
    res.json({
      conversationId: conversation._id,
      response: llmResponse,
      conversation
    });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ message: 'Error processing chat message', error: error.message });
  }
});

// Continue a conversation
router.post('/continue', async (req, res) => {
  try {
    const { conversationId, messageIndex, serviceId } = req.body;
    const userId = req.session.userId;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'Conversation ID is required' });
    }
    
    const conversation = await Conversation.findOne({ 
      _id: conversationId, 
      user: userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const messageIdx = messageIndex !== undefined ? parseInt(messageIndex) : conversation.messages.length - 1;
    
    if (isNaN(messageIdx) || messageIdx < 0 || messageIdx >= conversation.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }
    
    // Get messages up to the specified index
    const messages = conversation.messages.slice(0, messageIdx + 1);
    
    // Make sure the last message is from the student to generate a response
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'student') {
      return res.status(400).json({ message: 'Last message should be from student to continue' });
    }
    
    let selectedServiceId = serviceId;
    
    // Check if the requested service is allowed for this user
    if (selectedServiceId) {
      const isAllowed = await isServiceAllowedForUser(userId, selectedServiceId);
      
      if (!isAllowed) {
        // If not allowed, fall back to current conversation service or user's default
        selectedServiceId = conversation.metadata.llmService || await getUserDefaultService(userId);
      }
      
      // If a different serviceId is provided, update the conversation's metadata
      if (selectedServiceId !== conversation.metadata.llmService) {
        // Create a deep copy of metadata and update it
        const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
        updatedMetadata.llmService = selectedServiceId;
        
        // For backward compatibility, also update tutorMode if the service follows the expected format
        const [provider, mode] = selectedServiceId.split('-');
        if (provider === 'gemini' && mode) {
          updatedMetadata.tutorMode = mode;
        }
        
        // Set the updated metadata
        conversation.metadata = updatedMetadata;
        
        // Save changes before generating response
        await conversation.save();
      }
    } else {
      // If no service specified, use conversation's current service
      selectedServiceId = conversation.metadata.llmService || await getUserDefaultService(userId);
    }
    
    // Generate LLM response
    const promptData = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      serviceId: selectedServiceId
    };
    
    const llmResponse = await generateLLMResponse(promptData);
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: llmResponse
    });
    
    await conversation.save();
    
    res.json({
      conversationId: conversation._id,
      response: llmResponse,
      conversation
    });
  } catch (error) {
    console.error('Error continuing conversation:', error);
    res.status(500).json({ message: 'Error continuing conversation', error: error.message });
  }
});

// Edit a message and get a new response
router.post('/edit', async (req, res) => {
  try {
    const { conversationId, messageIndex, newContent, serviceId } = req.body;
    const userId = req.session.userId;
    
    if (!conversationId || messageIndex === undefined || !newContent) {
      return res.status(400).json({ message: 'Conversation ID, message index, and new content are required' });
    }
    
    const conversation = await Conversation.findOne({ 
      _id: conversationId, 
      user: userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const messageIdx = parseInt(messageIndex);
    
    if (isNaN(messageIdx) || messageIdx < 0 || messageIdx >= conversation.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }
    
    // Check if this is a student message (only student messages can be edited)
    const targetMessage = conversation.messages[messageIdx];
    if (targetMessage.role !== 'student') {
      return res.status(400).json({ message: 'Only student messages can be edited' });
    }
    
    let selectedServiceId = serviceId;
    
    // Check if the requested service is allowed for this user
    if (selectedServiceId) {
      const isAllowed = await isServiceAllowedForUser(userId, selectedServiceId);
      
      if (!isAllowed) {
        // If not allowed, fall back to current conversation service or user's default
        selectedServiceId = conversation.metadata.llmService || await getUserDefaultService(userId);
      }
      
      // If a different serviceId is provided, update the conversation's metadata
      if (selectedServiceId !== conversation.metadata.llmService) {
        // Create a deep copy of metadata and update it
        const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
        updatedMetadata.llmService = selectedServiceId;
        
        // Set the updated metadata
        conversation.metadata = updatedMetadata;
      }
    } else {
      // If no service specified, use conversation's current service
      selectedServiceId = conversation.metadata.llmService || await getUserDefaultService(userId);
    }
    
    // Save original content if not already saved
    if (!targetMessage.edited) {
      targetMessage.originalContent = targetMessage.content;
      targetMessage.edited = true;
    }
    
    // Update message content
    targetMessage.content = newContent;
    targetMessage.timestamp = Date.now();
    
    // Keep messages only up to the edited message (removing all subsequent messages)
    conversation.messages = conversation.messages.slice(0, messageIdx + 1);
    
    await conversation.save();
    
    // Generate new LLM response
    const promptData = {
      messages: conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      serviceId: selectedServiceId
    };
    
    const llmResponse = await generateLLMResponse(promptData);
    
    // Add assistant response to conversation
    conversation.messages.push({
      role: 'assistant',
      content: llmResponse
    });
    
    await conversation.save();
    
    res.json({
      conversationId: conversation._id,
      response: llmResponse,
      conversation
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
});

module.exports = router; 