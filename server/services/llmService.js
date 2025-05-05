const { GoogleGenerativeAI } = require('@google/generative-ai');
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize OpenAI client
const openai = new OpenAI(process.env.OPENAI_API_KEY);

/**
 * LLM Service interface - all services will implement these functions
 */
class LLMServiceInterface {
  constructor(tutorMode = 'direct') {
    this.tutorMode = tutorMode;
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

        // If passed and not the last stage, move to the next stage
        if (passed && this.stage < this.stages.length - 1) {
            this.stage++;
            const nextMode = this.stages[this.stage];
            console.log(`Moving to next mode: ${nextMode}`);

            // Generate response for the next mode
            const { responseText: nextResponseText } = await this.generateResponseForMode(nextMode, messages);
            return { llmResponse: nextResponseText, tutorStage: this.stages[this.stage] };
        }

        return { llmResponse: responseText, tutorStage: this.stages[this.stage] };
      } else {
        // Default behavior for other modes
        const { responseText } = await this.generateResponseForMode(this.tutorMode, messages);
        return { llmResponse: responseText, tutorStage: this.tutorMode };
      }
    } catch (error) {
      console.error('Error generating LLM response:', error);
      throw error;
    }
  }

  generateSystemPromptForMode(mode) {
    throw new Error('Method not implemented');
  }

  async generateTitle(message) {
    throw new Error('Method not implemented');
  }

  // Helper method to extract evaluation from response
  extractEvaluation(responseText) {
    const evaluationMatch = responseText.match(/@Evaluation: (PASS|FAIL)/);
    return evaluationMatch ? evaluationMatch[1] : null;
  }
}

/**
 * Gemini LLM Service with different tutor modes
 */
class GeminiService extends LLMServiceInterface {
  constructor(tutorMode = 'direct') {
    super(tutorMode);
    this.model_string = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
  }

  /**
   * Generate system prompt based on tutor mode
   * @returns {string} - The system prompt
   */
  generateSystemPromptForMode(mode) {
    const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning.`;

    const prompts = {
      'sensemaking': `

      ${basePrompt}

      Task:
      - Ask the student one open-ended question to help them restate the problem in their own words.
      - After they reply, evaluate if they have:
        - Accurately restated the core goal? (Yes/No)
        - Identified at least one ambiguity or unclear part? (Yes/No)
      - If they haven't fully met these criteria, ask one more targeted open-ended question to guide them.

      Rules:
      - Your first response should always aim to understand the student's initial grasp, so the first evaluation you output at the end of your message MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` when the student's response clearly and accurately restates the core goal AND identifies at least one ambiguity.
      - In all other cases, output \`@Evaluation: FAIL\` and continue to guide the student with another question.
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'representation': `

      ${basePrompt}

      Task:
      - Ask the student one open-ended question to help them identify:
        1. Each input (with its expected data type)
        2. The output (with its data type)
        3. The core operations required (e.g., sorting, counting, filtering)
      - After their reply, evaluate if they have clearly and correctly described all three components.

      Rules:
      - Your first response should guide them towards identifying these, so your first evaluation MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` when all three components (inputs, output, operations) are clearly and correctly described.
      - If anything is missing or incorrect, output \`@Evaluation: FAIL\` and ask a question specifically targeting the missing or incorrect piece(s).
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'planning': `

      ${basePrompt}

      Task:
      - Ask the student to propose at least one distinct high-level solution strategy, including:
          1. A function name
          2. A one sentence summary
          3. Args and their description
          4. Returns and their description
          5. At least two test cases that are different from the examples given in the problem.
      - After their reply, evaluate if they have provided all five required pieces clearly and distinctly.

      Rules:
      - Your first response should prompt them to think about strategies, so your first evaluation MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` when all four pieces are complete, clear, and distinct for at least one proposed strategy.
      - If any item is missing, unclear, or incomplete, output \`@Evaluation: FAIL\` and guide them to fill the missing piece(s).
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'execution': `

      ${basePrompt}

      Task:
      - If the student hasn't already, ask them to select one proposed strategy.
      - Then, have them implement their strategy and then walk you step-by-step through how that strategy transforms a **sample input** into the correct output.
      - After their walkthrough, evaluate if every transformation step is clearly explained and in a logical order.

      Rules:
      - Your first response here should likely prompt them to choose a strategy and begin the walkthrough, so your first evaluation MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` when the entire transformation from sample input to output is clearly and logically explained step-by-step.
      - If steps are missing, out of order, or unclear, output \`@Evaluation: FAIL\` and prompt them to clarify.
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'monitoring': `
      ${basePrompt} Ask the student to compare their expected result to the actual output (if they have one), pinpoint exactly where they diverged, and hypothesize why. After their explanation, evaluate if they have correctly diagnosed the discrepancy.

      Rules:
      - Your first response should guide them through this comparison, so your first evaluation MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` if the student accurately identifies the divergence and provides a plausible hypothesis for why it occurred.
      - If their diagnosis is incorrect or incomplete, output \`@Evaluation: FAIL\` and ask guiding questions.
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'reflection': `
      ${basePrompt} Prompt the student to share their key insight from the problem-solving process, suggest how they would refine their approach next time, and name any remaining uncertainties. After their response, evaluate if they have provided thoughtful answers to all three parts.

      Rules:
      - Your first response should prompt them for these reflections, so your first evaluation MUST be \`@Evaluation: FAIL\`.
      - Only output \`@Evaluation: PASS\` if they provide a meaningful insight, a concrete suggestion for improvement, and identify any lingering uncertainties.
      - If any of these parts are missing or superficial, output \`@Evaluation: FAIL\` and encourage them to think deeper.
      - **IMPORTANT: Always end your message with exactly one line containing either \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. Do not include any other text after this line.**
    `,

      'direct': `
    ${basePrompt} Your goal is to provide clear, direct answers without additional context or explanation unless specifically asked.
    Example Interaction:
    Student Question: "How do I print text in Python?"
    AI Tutor: "print("Your text here")"
    `,

      'explanation': `
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
      const evaluation = this.extractEvaluation(responseText);

      return { responseText: responseText.replace(/@Evaluation: (PASS|FAIL)/g, ''), evaluation };
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
    super(tutorMode);
    this.model_string = process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
   * Generate system prompt based on tutor mode
   * @returns {string} - The system prompt
   */
  generateSystemPromptForMode(mode) {
    const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning. DO NOT interpret or paraphrase student responses. Only ask questions, follow evaluation strictly, and never summarize or teach unless prompted.`;

    const prompts = {
      'sensemaking': `
      ${basePrompt}

      Task:
      - Begin by asking the student *one* warm, open-ended question that helps them *restate the problem in their own words*. You are not testing them—you're checking their *understanding*.
      - After they reply, check if they:
        1. Accurately restated the main goal (e.g., what is the code meant to *produce or accomplish*?)
      
      Rules:
      - Always support the student gently, even when evaluating. Your first response MUST end with \`@Evaluation: FAIL\` to prompt further thinking.
      - If they don't restate main goal accurately, follow up with a kind, targeted question that helps them reflect more precisely on the missing part.
      - **IMPORTANT: End every message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text should follow this.**
    `,

      'representation': `
      ${basePrompt}

      Task:
      - Ask the student one open-ended question to help them identify:
        1. The input(s): what kind of data goes into the program? Include type (e.g., string, list, dict) and structure (e.g., single item? sequence? nested?)
        2. The output: what kind of data should the program produce? Include type and format.
        3. What core operations will be applied to the input (i.e. looping, decision-making, etc..)
    
      Rules:
      - Your first response must always end with \`@Evaluation: FAIL\`.
      - This is high level and meant to help the student understand the data they are working with, not about implementation, strategies, or test cases.
      - If any part is missing or incorrect, follow up with exactly one open-ended question to nudge them toward just that part—without giving examples or code.
      - **IMPORTANT: End every message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text after this.**
      `,

      'planning': `
      ${basePrompt}
      
      Task:
      Ask the student to write out a high-level strategy for solving the problem. Their plan should include:
      
        1. A function name
        2. A one-sentence summary of what the function does
        3. A list of arguments (with data types + meaning)
        4. What the function returns (type + meaning)
        5. Two new test cases (not from the original problem)
      
      Rules:
      - You're here to support planning, not execution. So your first response MUST be \`@Evaluation: FAIL\` to allow for iteration.
      - Only output \`@Evaluation: PASS\` if all 5 parts are present and clearly described.
      - Ask a follow-up question targeting missing parts if they don’t provide them all.
      
      - **IMPORTANT: Always end your message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text after this.**
      `,

      'execution': `
      ${basePrompt}

      Task:
      - Ask the student to choose a specific strategy (or function plan).
      - Then, have them implement their strategy. 
      - Once they provide an implementation, ask them to walk you their implementation for a small example input. 
      
      Rules:
      - This is about reasoning, not just code. If they skip steps or jump to conclusions, help them slow down and think.
      - Your first evaluation MUST be \`@Evaluation: FAIL\`.
      
      - **IMPORTANT: Always end your message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text after this.**
      `,

      'monitoring': `
      ${basePrompt}

      Task:
      - Ask the student to:
        1. Compare their expected output to what the program actually produced.
        2. Pinpoint where they diverged, if they failed their tests.
        3. Hypothesize *why* the difference occurred.
      
      Rules:
      - First response should guide them through this diagnostic thinking—your first evaluation MUST be \`@Evaluation: FAIL\`.
      - If their hypothesis is incomplete or unclear, gently push them to consider other possible causes (e.g., logic error, wrong loop, etc.).
      
      - **IMPORTANT: Always end your message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text after this.**
      `, 

      'reflection': `
      ${basePrompt}

      Task:
      Invite the student to reflect on the experience by answering three questions:
        1. What was your biggest insight or “aha” moment?
        2. What would you do differently next time?
        3. Is there anything you’re still unsure about?
      
      Rules:
      - Encourage thoughtful reflection, not surface-level answers.
      - First response MUST end with \`@Evaluation: FAIL\` to create space for deeper thought.
     - Students aren't allowed to skip the reflection.
      
      - **IMPORTANT: Always end your message with exactly one line: \`@Evaluation: PASS\` or \`@Evaluation: FAIL\`. No other text after this.**
      `,

      'direct': `
      ${basePrompt} Your goal is to provide clear, direct answers without additional context or explanation unless specifically asked.
      Example Interaction:
      Student Question: "How do I print text in Python?"
      AI Tutor: "print("Your text here")"
    `,

      'explanation': `
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
      const evaluation = this.extractEvaluation(responseText);

      return { responseText: responseText.replace(/@Evaluation: (PASS|FAIL)/g, ''), evaluation };
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
