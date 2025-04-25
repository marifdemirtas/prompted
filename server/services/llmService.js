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
  generateSystemPromptForMode(mode) {
    const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning.`;
    
    switch (mode) {
      case 'direct':
        return `${basePrompt}
        
Start with the token "DIRECT ANSWER".

Your goal is to provide clear, direct answers without additional context or explanation unless specifically asked.

Example Interaction:
Student Question: "How do I print text in Python?"
AI Tutor: "print("Your text here")"

`;
        
      case 'explanation':
        return `${basePrompt}
        
Start with the token "DIRECT EXPLANATION".

When answering questions, first clearly state the answer, then provide a brief, easy-to-follow explanation of the underlying concept or logic. Limit the explanation to 1 minute read, if the explanation is too long, ask the student if they want to continue.

Example Interaction:
Student Question: "What is a variable in programming?"
AI Tutor Answer: "A variable is a container for storing data values. Think of it like labeling a box to store items. In programming, variables store values such as numbers or strings, allowing us to reuse them easily."

`;

      case 'scaffolding-think':
        return `${basePrompt}
        
Your task is to think through a programming problem step-by-step as a student should, but do NOT solve it or write code. Instead, generate a clear and structured analysis of the problem, including:
- A description of what the problem is asking
- Identification of the input and output
- The type of problem (e.g. search, string manipulation, math)
- Any constraints or edge cases to watch out for
- A rough high-level plan for how one might approach solving it (no code)

Do not provide any actual code or solution.

Example output:
---
**Problem Understanding**: This problem is asking whether a given string is a palindrome.
**Input**: A string (e.g., "racecar")
**Output**: A boolean (True if the string is a palindrome, False otherwise)
**Problem Type**: String processing and comparison

**Edge Cases**:
- Empty strings
- Strings with punctuation or spaces
- Case sensitivity (e.g., "RaceCar" vs "racecar")

**High-Level Plan**:
1. Normalize the string (e.g., lowercase, remove non-alphabet characters)
2. Reverse the string
3. Compare the original and reversed strings
---

`;

      case 'scaffolding-explain':
        return `You are a list-to-paragraph translator. Your task is to read a structured list or bullet-point plan and rewrite it into a coherent paragraph that explains the underlying idea or approach in a way that's understandable to someone who hasn't seen the original list. Focus on clarity, logical flow, and completeness. The output should feel like a well-explained summary or narrative that captures the intention behind the original list.`;

      default:
        throw new Error(`Unsupported tutor mode: ${mode}`);
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

        if (this.tutorMode === 'scaffolding') {
            // Generate responses for both direct and explanation modes
            const _thinkResponse = await this.generateResponseForMode('scaffolding-think', messages);
            const thinkMessages = [
              { role: 'user', content: _thinkResponse } // Add the "think" response as input
            ];
            const thinkResponse = await this.generateResponseForMode('scaffolding-explain', thinkMessages);
            const explanationMessages = [
              ...messages, // Include the original conversation history
              { role: 'user', content: "Based on the student's analysis: " + _thinkResponse + "Provide step-by-step guidance to help the student transform this plan into a functional solution." }
            ];
            const explanationResponse = await this.generateResponseForMode('explanation', explanationMessages);

            // Combine responses
            return `COGNITIVE SCF\n\n\n ${thinkResponse}\n\n\n${explanationResponse}`;
        } else {
            // Default behavior for other modes
            return await this.generateResponseForMode(this.tutorMode, messages);
        }
    } catch (error) {
        console.error('Error generating LLM response:', error);
        throw error;
    }
  }


  async generateResponseForMode(mode, messages) {
    try {
      
      const systemPrompt = this.generateSystemPromptForMode(mode);
      
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