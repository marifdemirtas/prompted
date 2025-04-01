const express = require('express');
const router = express.Router();
const { generateLLMResponse, generateConversationTitle } = require('../services/llmService');
const Conversation = require('../models/Conversation');

// Process a message and get LLM response
router.post('/chat', async (req, res) => {
  try {
    const { conversationId, message, context, tutorMode, serviceId } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    let conversation;
    
    // Find or create conversation
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: 'Conversation not found' });
      }
      
      // If a different serviceId is provided, update the conversation's metadata
      if (serviceId && serviceId !== conversation.metadata.llmService) {
        // Create a deep copy of metadata and update it
        const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
        updatedMetadata.llmService = serviceId;
        
        // For backward compatibility, also update tutorMode if the service follows the expected format
        const [provider, mode] = serviceId.split('-');
        if (provider === 'gemini' && mode) {
          updatedMetadata.tutorMode = mode;
        }
        
        // Set the updated metadata
        conversation.metadata = updatedMetadata;
      }
    } else {
      // Determine which service to use
      // First check if serviceId is provided in the request
      // If not, try to find the most recent conversation and use its service
      let service = serviceId;
      
      if (!service) {
        // Find the most recent conversation with a valid llmService
        const recentConversation = await Conversation.findOne({
          'metadata.llmService': { $exists: true }
        }).sort({ updatedAt: -1 });
        
        if (recentConversation && recentConversation.metadata.llmService) {
          service = recentConversation.metadata.llmService;
        } else if (tutorMode) {
          // Fallback to tutorMode if provided
          service = `gemini-${tutorMode}`;
        } else {
          // Default fallback
          service = 'gemini-dialogue';
        }
      }
      
      // Get the service name to use in the title
      const serviceFormatted = service.split('-').map(word => 
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
        context: context || '',
        messages: [],
        metadata: {
          // For backward compatibility, store both tutorMode and llmService
          tutorMode: service.split('-')[1] || 'dialogue',
          llmService: service
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
      context: conversation.context,
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

// Use LLM to generate a response from a forked conversation
router.post('/continue', async (req, res) => {
  try {
    const { conversationId, messageIndex, serviceId } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({ message: 'Conversation ID is required' });
    }
    
    const conversation = await Conversation.findById(conversationId);
    
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
    
    // If a different serviceId is provided, update the conversation's metadata
    if (serviceId && serviceId !== conversation.metadata.llmService) {
      // Create a deep copy of metadata and update it
      const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
      updatedMetadata.llmService = serviceId;
      
      // For backward compatibility, also update tutorMode if the service follows the expected format
      const [provider, mode] = serviceId.split('-');
      if (provider === 'gemini' && mode) {
        updatedMetadata.tutorMode = mode;
      }
      
      // Set the updated metadata
      conversation.metadata = updatedMetadata;
      
      // Save changes before generating response
      await conversation.save();
    }
    
    // Select service to use (either the provided one or the conversation's stored one)
    const selectedServiceId = serviceId || conversation.metadata.llmService || 
                          `gemini-${conversation.metadata.tutorMode || 'dialogue'}`;
    
    // Generate LLM response
    const promptData = {
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      context: conversation.context,
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

// Add route to handle message editing
router.post('/edit', async (req, res) => {
  try {
    const { conversationId, messageIndex, newContent, serviceId } = req.body;
    
    if (!conversationId || messageIndex === undefined || !newContent) {
      return res.status(400).json({ message: 'Missing required parameters' });
    }
    
    const conversation = await Conversation.findById(conversationId);
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const idx = parseInt(messageIndex);
    
    if (isNaN(idx) || idx < 0 || idx >= conversation.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }
    
    // Update the message
    const message = conversation.messages[idx];
    if (!message.edited) {
      message.originalContent = message.content;
      message.edited = true;
    }
    message.content = newContent;
    
    // If a different serviceId is provided, update the conversation's metadata
    if (serviceId && serviceId !== conversation.metadata.llmService) {
      // Create a deep copy of metadata and update it
      const updatedMetadata = JSON.parse(JSON.stringify(conversation.metadata));
      updatedMetadata.llmService = serviceId;
      
      // For backward compatibility, also update tutorMode if the service follows the expected format
      const [provider, mode] = serviceId.split('-');
      if (provider === 'gemini' && mode) {
        updatedMetadata.tutorMode = mode;
      }
      
      // Set the updated metadata
      conversation.metadata = updatedMetadata;
    }
    
    // If we're editing a student message and there's a next message from the assistant, regenerate that response
    const isStudent = message.role === 'student';
    const hasNextAssistantMessage = isStudent && idx + 1 < conversation.messages.length && 
                                  conversation.messages[idx + 1].role === 'assistant';
    
    if (hasNextAssistantMessage) {
      // Select service to use (either the provided one or the conversation's stored one)
      const selectedServiceId = serviceId || conversation.metadata.llmService || 
                             `gemini-${conversation.metadata.tutorMode || 'dialogue'}`;
      
      // Generate a new response based on the edited message
      const promptData = {
        messages: conversation.messages.slice(0, idx + 1).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        context: conversation.context,
        serviceId: selectedServiceId
      };
      
      const llmResponse = await generateLLMResponse(promptData);
      
      // Update the assistant message
      conversation.messages[idx + 1].content = llmResponse;
      conversation.messages[idx + 1].edited = true;
    }
    
    await conversation.save();
    
    res.json({
      success: true,
      conversation
    });
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
});

module.exports = router; 