const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * LLM Service interface - all services will implement these functions
 */
class LLMServiceInterface {
  async generateResponse(promptData) {
    throw new Error('Method not implemented');
  }
  
  async generateTitle(message) {
    throw new Error('Method not implemented');
  }
}

/**
 * Gemini LLM Service with different tutor modes
 */
class GeminiService extends LLMServiceInterface {
  constructor(tutorMode = 'direct') {
    super();
    this.tutorMode = tutorMode;
    this.model_string = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  }
  
  /**
   * Generate system prompt based on tutor mode
   * @returns {string} - The system prompt
   */
  generateSystemPrompt() {
    const basePrompt = `You are an AI tutor specializing in computer science education.`;
    
    switch (this.tutorMode) {
      case 'direct':
        return `${basePrompt}
        
Start with the token "DIRECT ANSWER". When responding to the student, provide direct answers to their questions without additional explanation or scaffolding. Be concise and precise, focusing only on the exact information requested.`;
        
      case 'explanation':
        return `${basePrompt}
        
Start with the token "DIRECT EXPLANATION". When responding to the student, provide clear explanations that break down concepts. Include examples where helpful, but don't use Socratic questioning. Teach the material directly with comprehensive explanations.`;
                
      case 'scaffolding':
        return `${basePrompt}
        
Start with the token "COGNITIVE SCF". When responding to the student, provide cognitive scaffolding to help them solve problems themselves. Break problems into steps, provide hints rather than answers, and gradually build their understanding. Focus on guiding their learning process rather than giving solutions.`;
    }
  }
  
  /**
   * Convert the role format from Conversation model to Gemini format
   * @param {string} role - Role from the Conversation model ('student' or 'assistant')
   * @returns {string} - Role in Gemini format ('user' or 'model')
   */
  convertRoleForGemini(role) {
    return role === 'student' ? 'user' : 'model';
  }
  
  /**
   * Generate LLM response based on conversation history
   * @param {Object} promptData - Data for generating the prompt
   * @param {Array} promptData.messages - Array of message objects with role and content
   * @returns {Promise<string>} - The LLM response
   */
  async generateResponse(promptData) {
    try {
      const { messages } = promptData;
      
      const systemPrompt = this.generateSystemPrompt();
      
      // Initialize conversation with system prompt
      const geminiMessages = [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\nPlease acknowledge these instructions.` }] },
        { role: 'model', parts: [{ text: 'I understand my role as an AI tutor for computer science education. I will adjust my teaching style based on the specified mode. I am ready to assist the student.' }] }
      ];
      
      // Add conversation history
      messages.forEach(msg => {
        geminiMessages.push({
          role: this.convertRoleForGemini(msg.role),
          parts: [{ text: msg.content }]
        });
      });
  
      // Use appropriate Gemini model
      const model = genAI.getGenerativeModel({ model: this.model_string });
  
      // Create a chat session
      const chat = model.startChat({
        history: geminiMessages.slice(0, -1),  // Exclude the last message to use it as the generation prompt
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        }
      });
  
      // Generate response using the last message
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessage(lastMessage.parts[0].text);
      
      return result.response.text();
    } catch (error) {
      console.error('Error generating LLM response:', error);
      throw error;
    }
  }
  
  /**
   * Generate a title for a new conversation based on the first message
   * @param {string} message - First message in the conversation
   * @returns {Promise<string>} - Generated title
   */
  async generateTitle(message) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-flash-lite' });
      
      const prompt = "Generate a short, concise title (5-7 words max) for a conversation that starts with the following message. Return only the title with no additional text or quotes.\n\nMessage: " + message;
      
      const result = await model.generateContent(prompt);
      
      return result.response.text().trim().replace(/["']/g, '');
    } catch (error) {
      console.error('Error generating conversation title:', error);
      // Fallback to truncated message if title generation fails
      return message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
  }
}

/**
 * Factory function to get the appropriate LLM service based on service ID
 * @param {string} serviceId - The ID of the service to use
 * @returns {LLMServiceInterface} - An instance of the appropriate LLM service
 */
function getLLMService(serviceId) {
  // If no serviceId provided, return null to let the caller handle the default
  if (!serviceId) {
    return null;
  }
  
  // Parse the service ID to get the provider and mode
  const [provider, mode] = serviceId.split('-');
  
  if (provider === 'gemini') {
    return new GeminiService(mode);
  }
  
  // Default to Gemini with direct answer mode if provider is not recognized
  return new GeminiService('direct');
}

/**
 * Generate LLM response based on conversation history
 * @param {Object} promptData - Data for generating the prompt
 * @param {Array} promptData.messages - Array of message objects with role and content
 * @param {string} promptData.serviceId - ID of the LLM service to use
 * @returns {Promise<string>} - The LLM response
 */
async function generateLLMResponse(promptData) {
  try {
    const { serviceId } = promptData;
    const service = getLLMService(serviceId);
    
    if (!service) {
      throw new Error('No LLM service ID provided');
    }
    
    return await service.generateResponse(promptData);
  } catch (error) {
    console.error('Error generating LLM response:', error);
    throw error;
  }
}

/**
 * Generate a title for a new conversation based on the first message
 * @param {string} message - First message in the conversation
 * @param {string} serviceId - ID of the LLM service to use
 * @returns {Promise<string>} - Generated title
 */
async function generateConversationTitle(message, serviceId) {
  try {
    const service = getLLMService(serviceId);
    
    if (!service) {
      // Fallback to truncated message if no service is provided
      return message.length > 30 ? message.substring(0, 30) + '...' : message;
    }
    
    return await service.generateTitle(message);
  } catch (error) {
    console.error('Error generating conversation title:', error);
    // Fallback to truncated message if title generation fails
    return message.length > 30 ? message.substring(0, 30) + '...' : message;
  }
}

module.exports = {
  generateLLMResponse,
  generateConversationTitle
}; 