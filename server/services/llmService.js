const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning.`;

const prompts = {
  'sensemaking': `Start your reply with the token "SENSEMAKING".
Task:
- Ask the student one open-ended question to help them restate the problem in their own words.
- After they reply, evaluate:
- Did they accurately restate the core goal? (Yes/No)
- Did they identify at least one ambiguity or unclear part? (Yes/No)
- If they didn't accurately restate the core goal or identify at least one ambiguity or unclear part, ask them one open-ended question to help them identify the core goal or ambiguity or unclear part.

Rules:
- If either answer is No, output \`@Evaluation: FAIL\` and ask a new question focused on the missing part.
- If both answers are Yes, output \`@Evaluation: PASS\`.
- After @Evaluation: PASS, stop asking further questions and wait for next instruction.
**IMPORTANT: Always emit exactly one evaluation line (\`@Evaluation: PASS\` or \`@Evaluation: FAIL\`) at the end of each message. Never omit, reword, or modify it. The first evaluation must always be FAIL.**
`,

  'representation': `Start your reply with the token "REPRESENTATION".

${basePrompt}

Task:
- Ask the student one open-ended question so they identify the following about the problem:
1. Each input (with its expected data type)
2. The output (with its data type)
3. The core operations required (e.g., sorting, counting, filtering)

After they reply, evaluate:
- Are all three components (inputs, output, operations) clearly and correctly described? (Yes/No)

Rules:
- If anything is missing or incorrect, output \`@Evaluation: FAIL\` and ask a question specifically targeting the missing piece(s).
- If all components are complete and correct, output \`@Evaluation: PASS\`.
- After @Evaluation: PASS, stop asking and wait for next instruction.

IMPORTANT: Always emit exactly one evaluation line (\`@Evaluation: PASS\` or \`@Evaluation: FAIL\`) at the end of each message. Never omit, reword, or modify it. The first evaluation must always be FAIL.
`,

  'planning': `Start your reply with the token "PLANNING".

${basePrompt}

Task:
- Ask the student to propose at least one distinct high-level solution strategy.
- Require:
1. A short name for the strategy
2. A one-sentence description
3. One benefit
4. One drawback

After they reply, evaluate:
- Did they clearly provide all four required pieces? (Yes/No)

Rules:
- If any item is missing, unclear, or incomplete, output \`@Evaluation: FAIL\` and guide them to fill the missing piece(s).
- If all four are complete and clear, output \`@Evaluation: PASS\`.
- After @Evaluation: PASS, stop asking and wait for the next instruction.

IMPORTANT: Always emit exactly one evaluation line (\`@Evaluation: PASS\` or \`@Evaluation: FAIL\`) at the end of each message. Never omit, reword, or modify it. The first evaluation must always be FAIL.
`,

  'execution': `Start your reply with the token "EXECUTION".

${basePrompt}

Task:
- Ask the student to select one proposed strategy.
- Then, have them walk step-by-step through transforming a **sample input** into the correct output using that strategy.

After they reply, evaluate:
- Did they explain every transformation step clearly and in order? (Yes/No)

Rules:
- If steps are missing, out of order, or unclear, output \`@Evaluation: FAIL\` and prompt them to walk through it more carefully.
- If the steps are complete and clear, output \`@Evaluation: PASS\`.
- After @Evaluation: PASS, stop asking and wait for next instruction.

IMPORTANT: Always emit exactly one evaluation line (\`@Evaluation: PASS\` or \`@Evaluation: FAIL\`) at the end of each message. Never omit, reword, or modify it. The first evaluation must always be FAIL.
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

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize OpenAI client
const openai = new OpenAI(process.env.OPENAI_API_KEY);

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

class OpenAIService extends LLMServiceInterface {
  constructor(tutorMode = 'direct') {
    super();
    this.tutorMode = tutorMode;
    this.model_string = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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

  generateSystemPromptForMode(mode) {
    if (prompts[mode]) {
      return prompts[mode];
    } else {
      throw new Error(`Unsupported tutor mode: ${mode}`);
    }
  }

  /**
   * Convert the role format from Conversation model to OpenAI format
   * @param {string} role - Role from the Conversation model ('student' or 'assistant')
   * @returns {string} - Role in OpenAI format ('user' or 'assistant')
   */
  convertRoleForOpenAI(role) {
    if (role === 'student') return 'user';
    if (role === 'assistant') return 'assistant';
    return role; // For system or other roles
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
        const { responseText } = await this.generateResponseForMode(this.tutorMode, messages);
        return responseText;
      }
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
      throw error;
    }
  }

  async generateResponseForMode(mode, messages) {
    try {
      const systemPrompt = this.generateSystemPromptForMode(mode);

      // Initialize conversation with system prompt
      const openaiMessages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please acknowledge these instructions.' },
        { role: 'assistant', content: 'I understand my role as an AI tutor for computer science education. I will adjust my teaching style based on the specified mode. I am ready to assist the student.' }
      ];

      // Add conversation history
      messages.forEach(msg => {
        openaiMessages.push({
          role: this.convertRoleForOpenAI(msg.role),
          content: msg.content
        });
      });

      // Generate response using OpenAI API
      const result = await openai.chat.completions.create({
        model: this.model_string,
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const responseText = result.choices[0].message.content;

      // Extract evaluation message
      const evaluationMatch = responseText.match(/@Evaluation: (PASS|FAIL)/);
      const evaluation = evaluationMatch ? evaluationMatch[1] : null;

      return { responseText, evaluation };
    } catch (error) {
      console.error('Error generating OpenAI response:', error);
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
      const prompt = "Generate a short, concise title (5-7 words max) for a conversation that starts with the following message. Return only the title with no additional text or quotes.\n\nMessage: " + message;

      const result = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You generate short, concise titles for conversations. Return only the title with no quotes or additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

      return result.choices[0].message.content.trim().replace(/["']/g, '');
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
  // Parse the service ID to get the provider and mode
  const [provider, mode] = serviceId.split('-');

  // Check if the service instance already exists for the conversation
  if (req.session.llmServices && req.session.llmServices[conversationId]) {
    let instance = req.session.llmServices[conversationId].instance;

    // Rehydrate the instance if it has lost its prototype
    if (!(instance instanceof LLMServiceInterface)) {
      console.log('Rehydrating LLM Service instance from session...');
      const { tutorMode, model_string, stage, stages } = instance;

      // Determine which service class to instantiate based on the stored serviceId
      if (provider === 'openai') {
        instance = new OpenAIService(tutorMode);
      } else {
        instance = new GeminiService(tutorMode);
      }

      instance.model_string = model_string;
      instance.stage = stage;
      instance.stages = stages;

      // Update the session with the rehydrated instance
      req.session.llmServices[conversationId].instance = instance;
    }

    return instance;
  }

  // If no existing instance, create a new one
  let serviceInstance;

  if (provider === 'gemini') {
    serviceInstance = new GeminiService(mode);
  } else if (provider === 'openai') {
    serviceInstance = new OpenAIService(mode);
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
  generateConversationTitle,
  LLMServiceInterface,
  GeminiService,
  OpenAIService
};