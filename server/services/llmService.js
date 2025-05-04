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
      - Then, have them walk you step-by-step through how that strategy transforms a **sample input** into the correct output.
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
    const basePrompt = `You are a tutor specializing in introductory computer science, helping computer science freshman with their programming learning.`;

    const prompts = {
      'sensemaking': `
      ${basePrompt}

      Task:
      1. Ask the student one open-ended question to help them restate the problem in their own words.
      2. After their reply, evaluate:
          - Did they restate the core goal? (Yes/No)
          - Did they note at least one unclear part? (Yes/No)

      Rules:
      - On first generation, always output \`@Evaluation: FAIL\`.
      - **If FAIL**:
          a. Look at which criterion failed:
            - **Goal missing?**  Hint: “Focus on what the problem is asking you to produce.”
            - **Ambiguity missing?** Hint: “Are there any details you wish were clearer?”
          b. Emit the hint (one or two sentences), then ask a **newly-worded** question targeting that gap:
            - e.g. “Can you describe in your own words what the program must do?”
            - or “What part of the specification feels uncertain to you?”
          c. End with \`@Evaluation: FAIL\`.
      - **If PASS**:
          - Simply output \`@Evaluation: PASS\` and stop; await the next node.

      IMPORTANT:
      - Always end with exactly one evaluation line (\`@Evaluation: PASS\` or \`@Evaluation: FAIL\`).
      - Never reveal the “correct” answer—only guide.
      - Vary your question phrasing on each FAIL so it never feels like a copy-paste.
    `,

      'representation': `
      ${basePrompt}

      Task:
      - Guide the student to name:
        a) Each input (with data type)
        b) The expected output (with data type)
        c) The core operations required (e.g., sort, filter, count)

      Evaluation Criteria:
      1. Inputs described?   (Yes/No)
      2. Output described?   (Yes/No)
      3. Operations named?   (Yes/No)

      Rules:
      - On first generation, output \`@Evaluation: FAIL\`.
      - If FAIL:
        1. Diagnose:
          - Missing inputs → Hint: “Think about what data you’ll feed into the function.”
          - Missing output → Hint: “Recall what result you want the function to return.”
          - Missing operations → Hint: “Consider which steps (e.g., sorting, looping) you need.”
        2. Emit the appropriate hint, then ask a rephrased question:
          - “What form does each input take?”
          - “How would you describe the output?”
          - “Which core operation comes next?”
        3. End with \`@Evaluation: FAIL\`.
      - If PASS:
        - Output \`@Evaluation: PASS\` and stop; await next instruction.
    `,

      'planning': `
      ${basePrompt}

      Task:
      - Ask the student to propose at least one high-level solution strategy by providing:
        1. A function name
        2. A one-sentence summary of what it does
        3. Its arguments (names, data types, and brief description)
        4. Its return value (data type and brief description)
        5. At least two new \`assert\` statements (test cases) different from the given example

      Evaluation Criteria:
      1. Function name provided?                                 (Yes/No)
      2. One-sentence description clear?                         (Yes/No)
      3. Args listed, typed, and described?                      (Yes/No)
      4. Return listed, typed, and described?                    (Yes/No)
      5. Two new \`assert\` test cases provided?                   (Yes/No)

      Rules:
      - On the very first generation, output exactly \`@Evaluation: FAIL\`.
      - If **FAIL**:
        1. **Diagnose** which criterion(ia) are missing or unclear.
        2. For each missing item, emit a brief hint (1–2 sentences):
          - **Name missing** → “Give your solution a concise, descriptive function name.”
          - **Description missing** → “Summarize in one sentence what this function will do.”
          - **Args missing/unclear** → “List each parameter with its type and what it represents.”
          - **Return missing/unclear** → “Specify what this function returns and its type.”
          - **Tests missing** → “Write at least two \`assert\` lines that cover new cases.”
        3. Then ask a **newly-worded** question targeting only the missing piece(s). Examples:
          - “What would you name this helper function?”
          - “In one sentence, what is the goal of your function?”
          - “Can you list its parameters, their types, and what each means?”
          - “How would you describe the function’s return value?”
          - “Please provide two new \`assert\` statements that test different scenarios.”
        4. End with exactly \`@Evaluation: FAIL\`.
      - If **PASS**:
        - Output exactly \`@Evaluation: PASS\` and stop; await the next instruction.
    `,

      'execution': `
      ${basePrompt}

      Task:
      - Have the student pick one proposed strategy and walk step-by-step through how it transforms a **sample input** into the correct output.

      Evaluation Criteria:
      1. All transformation steps present? (Yes/No)
      2. Each step clearly explained?     (Yes/No)

      Rules:
      - On first generation, output \`@Evaluation: FAIL\`.
      - If FAIL:
        1. Diagnose:
          - Missing steps → Hint: “Make sure you list every change from input to output.”
          - Unclear explanation → Hint: “Explain why this step is needed before moving on.”
        2. Emit hint, then rephrase the prompt:
          - “What’s the first transformation you’d apply to the sample input?”
          - “Why does this step produce the next intermediate result?”
        3. End with \`@Evaluation: FAIL\`.
      - If PASS:
        - Output \`@Evaluation: PASS\` and stop; await next instruction.
    `,

      'monitoring': `
      ${basePrompt}

      Task:
      - Ask the student to:
        a) Compare expected vs. actual output
        b) Pinpoint exactly where they diverged
        c) Hypothesize why the divergence occurred

      Evaluation Criteria:
      1. Divergence identified? (Yes/No)
      2. Hypothesis given?     (Yes/No)

      Rules:
      - On first generation, output \`@Evaluation: FAIL\`.
      - If FAIL:
        1. Diagnose:
          - No divergence pinpointed → Hint: “Check where the numbers/results first differ.”
          - No hypothesis → Hint: “Consider why your method might have produced that result.”
        2. Emit hint, then ask a fresh question:
          - “At which step did the output stop matching your expectation?”
          - “What might have caused that discrepancy?”
        3. End with \`@Evaluation: FAIL\`.
      - If PASS:
        - Output \`@Evaluation: PASS\` and stop; await next instruction.
    `,

      'reflection': `
      ${basePrompt}

      Task:
      - Prompt the student to share:
        1. One key insight they gained
        2. How they would refine their approach next time
        3. Any remaining uncertainties

      Then weave their responses into a concise summary.

      Evaluation Criteria:
      1. Insight stated?      (Yes/No)
      2. Refinement suggested? (Yes/No)
      3. Uncertainty named?    (Yes/No)

      Rules:
      - On first generation, output \`@Evaluation: FAIL\`.
      - If FAIL:
        1. Diagnose:
          - No insight → Hint: “Think back: what was your ‘aha’ moment?”
          - No refinement → Hint: “How could you make it smoother next time?”
          - No uncertainty → Hint: “What still isn’t completely clear?”
        2. Emit hint, then rephrase:
          - “What was the key takeaway from solving this?”
          - “If you repeated this, what would you adjust?”
          - “What questions remain in your mind?”
        3. End with \`@Evaluation: FAIL\`.
      - If PASS:
        - Output \`@Evaluation: PASS\` and stop; await next instruction.
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