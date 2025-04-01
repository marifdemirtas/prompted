const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['student', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  originalContent: {
    type: String,
    default: null
  }
});

const ConversationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    default: 'New Conversation'
  },
  context: {
    type: String,
    default: ''
  },
  messages: [MessageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  metadata: {
    tutorMode: {
      type: String,
      default: 'dialogue'
    },
    llmService: {
      type: String,
      default: 'gemini-dialogue'
    },
    subject: {
      type: String,
      default: 'Computer Science'
    },
    tags: [String]
  }
});

// Update the timestamp when saving
ConversationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to add a message to conversation
ConversationSchema.methods.addMessage = function(role, content) {
  this.messages.push({ role, content });
  return this.save();
};

// Method to edit a message
ConversationSchema.methods.editMessage = function(messageId, newContent) {
  const message = this.messages.id(messageId);
  if (!message) return null;
  
  if (!message.edited) {
    message.originalContent = message.content;
    message.edited = true;
  }
  
  message.content = newContent;
  message.timestamp = Date.now();
  
  return this.save();
};

// Method to get conversation fork from specific message
ConversationSchema.methods.forkFromMessage = function(messageIndex) {
  if (messageIndex < 0 || messageIndex >= this.messages.length) return null;
  
  // Determine the title for the forked conversation
  let forkedTitle;
  const serviceInfo = this.metadata.llmService || 
      `gemini-${this.metadata.tutorMode || 'dialogue'}`;
  
  // Format service name for display
  const serviceFormatted = serviceInfo.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  
  // Check if the title already has a service prefix
  const titleRegex = /^\[([\w\s]+)\]\s(.+)$/;
  const titleMatch = this.title.match(titleRegex);
  
  if (titleMatch) {
    // Keep the service name from the original title
    const contentPart = ""; // titleMatch[2];
    // Limit to ensure total length doesn't exceed 100 chars
    const prefix = `F: `;
    const maxContentLength = 100 - prefix.length;
    const truncatedContent = contentPart.length > maxContentLength
      ? contentPart.substring(0, maxContentLength - 3) + '...'
      : contentPart;
    forkedTitle = prefix + truncatedContent;
  } else {
    // Create a new formatted title with the service name
    const prefix = `F: `;
    const maxContentLength = 100 - prefix.length;
    const baseContent = this.title.replace(/^F-/, ''); // Remove existing fork prefix if any
    const truncatedContent = baseContent.length > maxContentLength
      ? baseContent.substring(0, maxContentLength - 3) + '...'
      : baseContent;
    forkedTitle = prefix + truncatedContent;
  }
  
  // Create a deep copy of the metadata object
  const metadataCopy = JSON.parse(JSON.stringify(this.metadata));
  
  const forkedConversation = {
    title: forkedTitle,
    context: this.context,
    messages: this.messages.slice(0, messageIndex + 1),
    metadata: metadataCopy
  };
  
  return this.model('Conversation').create(forkedConversation);
};

module.exports = mongoose.model('Conversation', ConversationSchema); 