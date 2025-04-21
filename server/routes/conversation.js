const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');

// Get all conversations for the current user
router.get('/', async (req, res) => {
  try {
    const conversations = await Conversation.find({ user: req.session.userId })
      .sort({ updatedAt: -1 })
      .select('title createdAt updatedAt metadata');
    
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Error fetching conversations', error: error.message });
  }
});

// Get a specific conversation
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOne({ 
      _id: req.params.id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ message: 'Error fetching conversation', error: error.message });
  }
});

// Create a new conversation
router.post('/', async (req, res) => {
  try {
    const { title, metadata } = req.body;
    
    const newConversation = new Conversation({
      title: title || 'New Conversation',
      metadata,
      user: req.session.userId
    });
    
    const savedConversation = await newConversation.save();
    res.status(201).json(savedConversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Error creating conversation', error: error.message });
  }
});

// Add a message to a conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const { role, content } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({ message: 'Role and content are required' });
    }
    
    const conversation = await Conversation.findOne({ 
      _id: req.params.id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    conversation.messages.push({ role, content });
    await conversation.save();
    
    res.status(201).json(conversation);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ message: 'Error adding message', error: error.message });
  }
});

// Edit a message in a conversation
router.put('/:id/messages/:messageIndex', async (req, res) => {
  try {
    const { content } = req.body;
    const { id, messageIndex } = req.params;
    
    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }
    
    const conversation = await Conversation.findOne({ 
      _id: id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    const messageIdx = parseInt(messageIndex);
    
    if (isNaN(messageIdx) || messageIdx < 0 || messageIdx >= conversation.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }
    
    const message = conversation.messages[messageIdx];
    
    if (!message.edited) {
      message.originalContent = message.content;
      message.edited = true;
    }
    
    message.content = content;
    message.timestamp = Date.now();
    
    await conversation.save();
    
    res.json(conversation);
  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ message: 'Error editing message', error: error.message });
  }
});

// Fork a conversation from a specific message
router.post('/:id/fork/:messageIndex', async (req, res) => {
  try {
    const { id, messageIndex } = req.params;
    const messageIdx = parseInt(messageIndex);
    
    const conversation = await Conversation.findOne({ 
      _id: id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (isNaN(messageIdx) || messageIdx < 0 || messageIdx >= conversation.messages.length) {
      return res.status(400).json({ message: 'Invalid message index' });
    }

    // Create a deep copy of the metadata object
    const metadataCopy = JSON.parse(JSON.stringify(conversation.metadata));

    // Determine the title for the forked conversation
    let forkedTitle;
    const serviceInfo = conversation.metadata.llmService || 
        `gemini-${conversation.metadata.tutorMode || 'dialogue'}`;
    
    // Format service name for display
    const serviceFormatted = serviceInfo.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
    
    // Check if the title already has a service prefix
    const titleRegex = /^\[([\w\s]+)\]\s(.+)$/;
    const titleMatch = "";//conversation.title.match(titleRegex);
    
    if (titleMatch) {
      // Keep the service name from the original title
      const contentPart = titleMatch[2];
      // Limit to ensure total length doesn't exceed 100 chars
      const prefix = `F: `;
      const maxContentLength = 100 - prefix.length;
      const truncatedContent = contentPart.length > maxContentLength
        ? contentPart.substring(0, maxContentLength - 3) + '...'
        : contentPart;
      forkedTitle = prefix + truncatedContent;
    } else {
      // Create a new formatted title
      const prefix = `F: `;
      const maxContentLength = 100 - prefix.length;
      const baseContent = conversation.title.replace(/^F-/, ''); // Remove existing fork prefix if any
      const truncatedContent = baseContent.length > maxContentLength
        ? baseContent.substring(0, maxContentLength - 3) + '...'
        : baseContent;
      forkedTitle = prefix + truncatedContent;
    }
    
    const forkedConversation = new Conversation({
      title: forkedTitle,
      context: conversation.context,
      messages: conversation.messages.slice(0, messageIdx + 1),
      metadata: metadataCopy,
      user: req.session.userId
    });
    
    const savedFork = await forkedConversation.save();
    
    res.status(201).json(savedFork);
  } catch (error) {
    console.error('Error forking conversation:', error);
    res.status(500).json({ message: 'Error forking conversation', error: error.message });
  }
});

// Update conversation context or metadata
router.put('/:id', async (req, res) => {
  try {
    const { title, metadata } = req.body;
    const { id } = req.params;
    
    const conversation = await Conversation.findOne({ 
      _id: id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    if (title) conversation.title = title;
    if (metadata) conversation.metadata = metadata;
    
    await conversation.save();
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ message: 'Error updating conversation', error: error.message });
  }
});

// Delete a conversation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const conversation = await Conversation.findOneAndDelete({ 
      _id: id,
      user: req.session.userId 
    });
    
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }
    
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ message: 'Error deleting conversation', error: error.message });
  }
});

module.exports = router; 