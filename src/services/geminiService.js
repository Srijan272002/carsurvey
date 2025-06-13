// Gemini AI Service for processing survey responses
const { TextServiceClient } = require('../services/geminiAdapter');
const { GoogleAuth } = require('google-auth-library');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

// Initialize the Google Gemini API client
const MODEL_NAME = 'models/gemini-pro';
const API_KEY = process.env.GOOGLE_AI_API_KEY;

// Create client without the GoogleAuth since our adapter handles auth internally
const client = new TextServiceClient();

// Load the system prompt from environment variables or config
const SYSTEM_PROMPT = process.env.SURVEY_PROMPT || `
You are a friendly automotive service survey assistant for Premium Motors. Follow these instructions precisely:

1. GREETING: Begin with a brief, courteous introduction.

2. COLLECT RATINGS: Ask the customer to rate on a scale of 0-10:
   - Overall satisfaction with their recent service
   - Quality of workmanship
   - Timeliness of service completion
   - Staff friendliness

3. FOLLOW-UP ITEMS: Listen for and identify:
   - Billing concerns or disputes
   - Mechanical issues requiring further attention
   - Warranty questions
   - Service logistics complaints (shuttle service, wait times)
   - Safety concerns

4. POSITIVE RECOGNITION: Note any compliments and staff names mentioned positively.

5. LANGUAGE ADAPTATION: If the customer speaks Spanish, continue the conversation in Spanish.

6. OUTPUT STRUCTURE: Return only a single JSON object with this exact format:
{
  "ratings": {
    "overall_satisfaction": <0-10>,
    "workmanship_quality": <0-10>,
    "service_timeliness": <0-10>,
    "staff_friendliness": <0-10>
  },
  "follow_up_items": {
    "billing_disputes": [<specific issues>],
    "mechanical_issues": [<specific issues>],
    "warranty_questions": [<specific questions>],
    "service_logistics": [<specific complaints>],
    "safety_concerns": [<specific concerns>]
  },
  "positive_remarks": [
    {"employee": "<name or description>", "comment": "<compliment>"}
  ],
  "preferred_language": "<English or Spanish>",
  "callback_needed": <true or false>
}

7. CALLBACK FLAG: Set "callback_needed" to true if ANY of these conditions exist:
   - Any rating is 5 or lower
   - Any billing dispute is mentioned
   - Any safety issue is mentioned
   - Any warranty clarification is requested

8. CONVERSATION FLOW: Maintain natural conversation while ensuring all required data is collected.
`;

/**
 * Process the transcription text from a call and extract structured data
 * @param {string} transcription - The text transcription from the call
 * @returns {Promise<Object>} Structured survey data in JSON format
 */
async function processSurveyResponse(transcription) {
  try {
    logger.info('Processing survey response with Gemini AI');
    
    const result = await client.generateText({
      model: MODEL_NAME,
      prompt: {
        text: `${SYSTEM_PROMPT}\n\nCustomer call transcript:\n${transcription}\n\nExtract the survey data in the JSON format specified above.`
      },
    });

    // Extract and parse JSON from the response
    const generatedText = result[0]?.candidates[0]?.output;
    if (!generatedText) {
      throw new Error('No response generated from Gemini AI');
    }

    // Find and extract JSON object from the response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Gemini response');
    }

    // Parse the JSON
    const parsedData = JSON.parse(jsonMatch[0]);
    logger.info('Successfully processed survey response');
    
    return parsedData;
  } catch (error) {
    logger.error('Error processing survey with Gemini AI:', error);
    throw new Error(`Failed to process survey response: ${error.message}`);
  }
}

/**
 * Detect the language from text
 * @param {string} text - The text to analyze
 * @returns {Promise<string>} Detected language ('English' or 'Spanish')
 */
async function detectLanguage(text) {
  try {
    const result = await client.generateText({
      model: MODEL_NAME,
      prompt: {
        text: `Determine if the following text is in English or Spanish. Only respond with "English" or "Spanish".\n\nText: "${text}"`
      },
    });

    const generatedText = result[0]?.candidates[0]?.output?.trim();
    if (generatedText && (generatedText.includes('Spanish') || generatedText.includes('Español'))) {
      return 'Spanish';
    }
    return 'English';
  } catch (error) {
    logger.error('Error detecting language:', error);
    // Default to English on error
    return 'English';
  }
}

/**
 * Generate the next appropriate response in the conversation
 * @param {string} conversation - The conversation history so far
 * @param {string} language - The language to respond in ('English' or 'Spanish')
 * @returns {Promise<string>} The next response in the conversation
 */
async function generateNextResponse(conversation, language = 'English') {
  try {
    let prompt = `${SYSTEM_PROMPT}\n\nConversation so far:\n${conversation}\n\n`;
    
    if (language === 'Spanish') {
      prompt += 'Please respond in Spanish to continue the survey.';
    } else {
      prompt += 'Please respond in English to continue the survey.';
    }

    const result = await client.generateText({
      model: MODEL_NAME,
      prompt: { text: prompt },
    });

    const response = result[0]?.candidates[0]?.output;
    if (!response) {
      throw new Error('No response generated from Gemini AI');
    }

    return response;
  } catch (error) {
    logger.error('Error generating conversation response:', error);
    if (language === 'Spanish') {
      return 'Lo siento, estoy teniendo problemas técnicos. ¿Podemos continuar con la encuesta?';
    } else {
      return 'I apologize, I am experiencing technical difficulties. Can we continue with the survey?';
    }
  }
}

module.exports = {
  processSurveyResponse,
  detectLanguage,
  generateNextResponse,
}; 