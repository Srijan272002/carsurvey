// Adapter for Google Gemini API to maintain backward compatibility
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

// Initialize the Google Gemini API client with the current API
const API_KEY = process.env.GOOGLE_AI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

/**
 * Adapter class to make the new Gemini API compatible with the old TextServiceClient interface
 */
class TextServiceClientAdapter {
  constructor() {
    // No configuration needed as we initialize the client separately
  }

  /**
   * Adapter method for generateText to match the old API structure
   * @param {Object} options - Options object with model and prompt
   * @returns {Promise<Object>} - Result in a format compatible with the old API
   */
  async generateText(options) {
    try {
      logger.info('Calling Gemini API through adapter');
      
      const prompt = options.prompt.text;
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      // Format the response to match the old API structure
      return [
        {
          candidates: [
            {
              output: text
            }
          ]
        }
      ];
    } catch (error) {
      logger.error('Error in Gemini API adapter:', error);
      throw error;
    }
  }
}

// Export the adapter as a drop-in replacement for TextServiceClient
module.exports = {
  TextServiceClient: TextServiceClientAdapter,
  // No need to provide GoogleAuth as it's not used directly
}; 