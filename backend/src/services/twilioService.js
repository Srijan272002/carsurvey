// Twilio Service for handling SMS messages
const twilio = require('twilio');
const { createLogger } = require('../utils/logger');
const geminiService = require('./geminiService');
const supabaseService = require('./supabaseService');

const logger = createLogger();

// Twilio client configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

/**
 * Send an initial SMS message to a customer for a survey
 * @param {Object} customer - Customer information
 * @param {Object} serviceVisit - Service visit information
 * @returns {Promise<Object>} Message details
 */
async function sendInitialSurvey(customer, serviceVisit) {
  try {
    logger.info(`Sending initial survey SMS to customer: ${customer.id} for service visit: ${serviceVisit.id}`);
    
    // Initial greeting message
    const initialMessage = 'Hello from Premium Motors! We would like your feedback on your recent service visit. On a scale of 0-10, how would you rate your overall satisfaction with our service?';
    
    // Send the message
    const message = await client.messages.create({
      body: initialMessage,
      from: twilioPhoneNumber,
      to: customer.phone,
      statusCallback: process.env.BASE_URL + '/api/webhooks/twilio/status',
    });
    
    // Log the message in the database
    await supabaseService.logMessage({
      service_visit_id: serviceVisit.id,
      sent_at: new Date(),
      status: 'sent',
      twilio_sid: message.sid,
      message_body: initialMessage,
      message_type: 'outbound',
      message_step: 'overall_satisfaction',
    });
    
    logger.info(`Initial survey SMS sent with SID: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error('Error sending initial Twilio SMS:', error);
    throw new Error(`Failed to send initial SMS: ${error.message}`);
  }
}

/**
 * Process an incoming SMS response from a customer
 * @param {string} messageSid - The Twilio message SID
 * @param {string} from - The customer's phone number
 * @param {string} body - The message content
 * @returns {Promise<Object>} The next message to send
 */
async function processIncomingSMS(messageSid, from, body) {
  try {
    logger.info(`Processing incoming SMS from ${from}: "${body}"`);
    
    // Store the incoming message
    await supabaseService.logMessage({
      sent_at: new Date(),
      status: 'received',
      twilio_sid: messageSid,
      message_body: body,
      message_type: 'inbound',
      from_number: from,
    });
    
    // Get the service visit and conversation history
    const { serviceVisit, conversation } = await supabaseService.getConversationByPhone(from);
    
    if (!serviceVisit) {
      logger.warn(`No active survey found for phone number: ${from}`);
      return null;
    }
    
    // Detect language
    const language = await geminiService.detectLanguage(body);
    
    // Add the customer's response to the conversation
    conversation.push({
      speaker: 'customer',
      text: body,
    });
    
    // Update conversation in the database
    await supabaseService.updateConversation(serviceVisit.id, conversation);
    
    // Determine which question to ask next based on the conversation state
    const currentStep = await determineCurrentStep(conversation);
    let nextResponse;
    
    // If we have all required ratings, process the complete survey
    if (currentStep === 'complete') {
      // Process the complete survey conversation
      const surveyData = await geminiService.processSurveyResponse(
        conversation.map(entry => `${entry.speaker}: ${entry.text}`).join('\n')
      );
      
      // Save the survey results
      await supabaseService.saveSurveyResults(serviceVisit.id, surveyData);
      
      // Send thank you message
      const thankYouMessage = language === 'Spanish' 
        ? 'Gracias por completar nuestra encuesta. Su opinión es muy importante para nosotros. ¡Que tenga un buen día!'
        : 'Thank you for completing our survey. Your feedback is very important to us. Have a great day!';
      
      const message = await client.messages.create({
        body: thankYouMessage,
        from: twilioPhoneNumber,
        to: from,
      });
      
      // Log the outbound message
      await supabaseService.logMessage({
        service_visit_id: serviceVisit.id,
        sent_at: new Date(),
        status: 'sent',
        twilio_sid: message.sid,
        message_body: thankYouMessage,
        message_type: 'outbound',
        message_step: 'thank_you',
      });
      
      return message;
    }
    
    // Otherwise, get the next question based on the current step
    switch (currentStep) {
      case 'overall_satisfaction':
        nextResponse = language === 'Spanish'
          ? '¿Cómo calificaría la calidad del trabajo realizado en su vehículo? (0-10)'
          : 'How would you rate the quality of workmanship on your vehicle? (0-10)';
        break;
        
      case 'workmanship_quality':
        nextResponse = language === 'Spanish'
          ? '¿Cómo calificaría la puntualidad del servicio? (0-10)'
          : 'How would you rate the timeliness of your service completion? (0-10)';
        break;
        
      case 'service_timeliness':
        nextResponse = language === 'Spanish'
          ? '¿Cómo calificaría la amabilidad de nuestro personal? (0-10)'
          : 'How would you rate the friendliness of our staff? (0-10)';
        break;
        
      case 'staff_friendliness':
        nextResponse = language === 'Spanish'
          ? '¿Hay algo específico sobre su visita que le gustaría que abordemos? (Por ejemplo, problemas de facturación, problemas mecánicos, preguntas de garantía, etc.)'
          : 'Is there anything specific about your visit you would like us to address? (e.g., billing issues, mechanical problems, warranty questions, etc.)';
        break;
        
      case 'follow_up':
        nextResponse = language === 'Spanish'
          ? '¿Le gustaría mencionar a algún miembro del personal que fue particularmente útil?'
          : 'Would you like to mention any staff member who was particularly helpful?';
        break;
        
      default:
        // Generate a dynamic response using Gemini if we can't determine the step
        nextResponse = await geminiService.generateNextResponse(
          conversation.map(entry => `${entry.speaker}: ${entry.text}`).join('\n'),
          language
        );
    }
    
    // Add the AI's response to the conversation
    conversation.push({
      speaker: 'ai',
      text: nextResponse,
    });
    
    // Update conversation in database
    await supabaseService.updateConversation(serviceVisit.id, conversation);
    
    // Send the next question
    const message = await client.messages.create({
      body: nextResponse,
      from: twilioPhoneNumber,
      to: from,
    });
    
    // Log the outbound message
    await supabaseService.logMessage({
      service_visit_id: serviceVisit.id,
      sent_at: new Date(),
      status: 'sent',
      twilio_sid: message.sid,
      message_body: nextResponse,
      message_type: 'outbound',
      message_step: getNextStep(currentStep),
    });
    
    return message;
  } catch (error) {
    logger.error('Error processing incoming SMS:', error);
    throw new Error(`Failed to process SMS: ${error.message}`);
  }
}

/**
 * Handle the message status callback from Twilio
 * @param {string} messageSid - The Twilio message SID
 * @param {string} messageStatus - The status of the message
 * @returns {Promise<void>}
 */
async function handleMessageStatusCallback(messageSid, messageStatus) {
  try {
    logger.info(`Message ${messageSid} status updated to: ${messageStatus}`);
    
    // Update message log in database
    await supabaseService.updateMessageStatus(messageSid, messageStatus);
    
    // If message failed, we might want to retry or log the failure
    if (['failed', 'undelivered'].includes(messageStatus)) {
      logger.warn(`Message ${messageSid} failed to deliver`);
      // Could implement retry logic here
    }
  } catch (error) {
    logger.error('Error handling message status callback:', error);
  }
}

/**
 * Determine the current step in the conversation based on context
 * @param {Array} conversation - The conversation history
 * @returns {string} The current step identifier
 */
async function determineCurrentStep(conversation) {
  // Count AI messages (excluding the initial greeting)
  const aiMessageCount = conversation.filter(msg => msg.speaker === 'ai').length;
  
  // Count meaningful customer responses
  const customerMessages = conversation.filter(msg => msg.speaker === 'customer');
  
  switch (aiMessageCount) {
    case 1: return 'overall_satisfaction'; // After initial question
    case 2: return 'workmanship_quality'; // After first follow-up
    case 3: return 'service_timeliness'; // After second follow-up
    case 4: return 'staff_friendliness'; // After third follow-up
    case 5: return 'follow_up'; // After fourth follow-up
    case 6: return 'staff_recognition'; // After fifth follow-up
    default:
      // If we've gone through all questions or have enough responses, mark as complete
      if (aiMessageCount > 6 || customerMessages.length >= 6) {
        return 'complete';
      }
      // Otherwise use a general identifier
      return 'additional_info';
  }
}

/**
 * Get the next step based on the current step
 * @param {string} currentStep - The current step identifier
 * @returns {string} The next step identifier
 */
function getNextStep(currentStep) {
  switch (currentStep) {
    case 'overall_satisfaction': return 'workmanship_quality';
    case 'workmanship_quality': return 'service_timeliness';
    case 'service_timeliness': return 'staff_friendliness';
    case 'staff_friendliness': return 'follow_up';
    case 'follow_up': return 'staff_recognition';
    case 'staff_recognition': return 'additional_info';
    case 'additional_info': return 'complete';
    default: return 'complete';
  }
}

module.exports = {
  sendInitialSurvey,
  processIncomingSMS,
  handleMessageStatusCallback,
}; 