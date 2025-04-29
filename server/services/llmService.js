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
    this.stage = 0; // only used if tutorMode is 'scaffolding'
    this.stages = [
      'sensemaking',
      'representation',
      'planning',
      'execution',
      'monitoring',
      'reflection'
    ];
  }
  
  /**
   * Generate system prompt based on tutor mode
   * @returns {string} - The system prompt
   */
  generateSystemPromptForMode(mode) {
    const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning.`;
    
    const prompts = {
      'sensemaking': `Start with the token "SENSEMAKING".
  ${basePrompt} Help the student restate the problem in their own words and uncover any unclear parts. After each reply, decide if the student truly grasped the core task and noted at least one ambiguity.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,

      'representation': `Start with the token "REPRESENTATION".
  ${basePrompt} Guide the student to identify each input (with its data type), the expected output type, and the core operations needed. After every reply, check for completeness and accuracy.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,

      'planning': `Start with the token "PLANNING".
  ${basePrompt} Ask the student to propose at least one distinct high-level solution strategy, with a concise name, a one-sentence description, and one benefit and one drawback. After each response, verify they've provided clear approaches.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,

      'execution': `Start with the token "EXECUTION".
  ${basePrompt} Have them pick one strategy and walk you step-by-step through how it transforms a sample input into the correct output. After each walkthrough, confirm that every transformation is clearly explained.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,

      'monitoring': `Start with the token "MONITORING".
  ${basePrompt} Ask the student to compare their expected result to the actual output, pinpoint exactly where they diverged, and hypothesize why. After each explanation, decide if they correctly diagnosed the discrepancy.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,

      'reflection': `Start with the token "REFLECTION".
  ${basePrompt} Prompt the student to share their key insight, suggest how they would refine their approach next time, and name any remaining uncertainties, then weave their answers into a concise summary.
IMPORTANT: For every message you output, at the very end of your reply, always emit exactly one of these two lines (and nothing else after it):
@Evaluation: PASS
@Evaluation: FAIL
Do not omit or rephrase this line under any circumstances. First evaluation you give is always FAIL.
  `,
      'direct': `Start with the token "DIRECT ANSWER".
  ${basePrompt} Your goal is to provide clear, direct answers without additional context or explanation unless specifically asked.
Example Interaction:
Student Question: "How do I print text in Python?"
AI Tutor: "print("Your text here")"

`,
      'explanation': `Start with the token "DIRECT EXPLANATION".
  ${basePrompt} When answering questions, first clearly state the answer, then provide a brief, easy-to-follow explanation of the underlying concept or logic. Limit the explanation to 1 minute read, if the explanation is too long, ask the student if they want to continue.
Example Interaction:
Student Question: "What is a variable in programming?"
AI Tutor Answer: "A variable is a container for storing data values. Think of it like labeling a box to store items. In programming, variables store values such as numbers or strings, allowing us to reuse them easily."
`
    };

    if (prompts[mode]) {
      return prompts[mode];
    } else {
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
            const mode = this.stages[this.stage] || this.stages[0];
            console.log(`Current mode: ${mode}`);

            // Get the response and evaluation
            const { responseText, evaluation } = await this.generateResponseForMode(mode, messages);

            // Determine if the stage is passed
            const passed = evaluation === 'PASS';

            console.log(`Passed: ${passed}, Current stage: ${this.stage + 1}, Total stages: ${this.stages.length}`);
            if (passed && this.stage < this.stages.length - 1) {
                this.stage++;
            }

            return responseText;
        } else {
            // Default behavior for other modes
            const { responseText, evaluation } = await this.generateResponseForMode(this.tutorMode, messages);
            return responseText;
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
      
      const responseText = result.response.text();

      // Extract evaluation message
      const evaluationMatch = responseText.match(/@Evaluation: (PASS|FAIL)/);
      const evaluation = evaluationMatch ? evaluationMatch[1] : null;

      return { responseText, evaluation };
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
function getLLMService(req, serviceId, conversationId) {
  // If no serviceId provided, return null to let the caller handle the default
  if (!serviceId) {
    throw new Error('No LLM service ID provided');
  }

  // Check if the service instance already exists for the conversation
  if (req.session.llmServices && req.session.llmServices[conversationId]) {
    let instance = req.session.llmServices[conversationId].instance;

    // Rehydrate the instance if it has lost its prototype
    if (!(instance instanceof LLMServiceInterface)) {
      console.log('Rehydrating LLM Service instance from session...');
      const { tutorMode, model_string, stage, stages } = instance;
      instance = new GeminiService(tutorMode);
      instance.model_string = model_string;
      instance.stage = stage;
      instance.stages = stages;

      // Update the session with the rehydrated instance
      req.session.llmServices[conversationId].instance = instance;
    }

    return instance;
  }
  
  // Parse the service ID to get the provider and mode
  const [provider, mode] = serviceId.split('-');
  let serviceInstance;
  
  if (provider === 'gemini') {
    serviceInstance = new GeminiService(mode);
  } else {
    serviceInstance = new GeminiService('direct'); // Default to direct mode if provider is not recognized
  }

  // Initialize the session object if it doesn't exist
  if (!req.session.llmServices) {
    req.session.llmServices = {};
  }

  // Store the service instance for the conversation
  req.session.llmServices[conversationId] = {
    serviceId,
    instance: serviceInstance,
  };
  
  // console.log('Created LLM Service instance:', serviceInstance);
  return serviceInstance;
}

/**
 * Generate LLM response based on conversation history
 * @param {Object} promptData - Data for generating the prompt
 * @param {Array} promptData.messages - Array of message objects with role and content
 * @param {string} promptData.serviceId - ID of the LLM service to use
 * @returns {Promise<string>} - The LLM response
 */
async function generateLLMResponse(req, promptData) {
  try {
    const { conversationId, serviceId } = promptData;
    const service = getLLMService(req, serviceId, conversationId);
    // console.log('Stored LLM Service in session:', req.session.llmServices[conversationId]);

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
async function generateConversationTitle(req, message, serviceId) {
  try {
    const service = getLLMService(req, serviceId);
    
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