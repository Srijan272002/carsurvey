// Scheduler Service for handling survey scheduling
const { createLogger } = require('../utils/logger');
const supabaseService = require('./supabaseService');
const twilioService = require('./twilioService');

const logger = createLogger();

/**
 * Schedule surveys for service visits that occurred in the past 24-48 hours
 * @returns {Promise<void>}
 */
async function scheduleSurveys() {
  try {
    logger.info('Starting to schedule SMS surveys for recent service visits');
    
    // Get service visits due for a survey
    const serviceVisits = await supabaseService.getServiceVisitsDueForSurvey();
    
    if (serviceVisits.length === 0) {
      logger.info('No service visits found due for a survey');
      return;
    }
    
    logger.info(`Found ${serviceVisits.length} service visits due for a survey`);
    
    // Process each service visit
    for (const visit of serviceVisits) {
      try {
        // Create a survey record
        const survey = await supabaseService.createSurvey(visit.id);
        
        // Get customer info from the nested customer object
        const customer = visit.customers;
        
        if (!customer || !customer.phone) {
          logger.warn(`Service visit ${visit.id} has no associated customer phone number`);
          continue;
        }
        
        // Send the initial survey SMS
        await twilioService.sendInitialSurvey(customer, visit);
        
        logger.info(`Successfully scheduled SMS survey for service visit ${visit.id}`);
      } catch (error) {
        logger.error(`Error scheduling SMS survey for service visit ${visit.id}:`, error);
        // Continue with next service visit even if one fails
      }
    }
    
    logger.info('Finished scheduling SMS surveys');
  } catch (error) {
    logger.error('Error in scheduleSurveys:', error);
    throw error;
  }
}

/**
 * Retry failed or undelivered survey messages
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<void>}
 */
async function retryFailedSurveys(maxRetries = 3) {
  try {
    logger.info('Starting to retry failed survey messages');
    
    // Query for failed messages from last 24 hours that have been attempted less than maxRetries times
    const { data: failedMessages, error } = await supabaseService.supabase
      .from('message_logs')
      .select(`
        *,
        service_visits!inner(
          id,
          customers(id, first_name, last_name, phone, email, preferred_language)
        )
      `)
      .in('status', ['failed', 'undelivered'])
      .eq('message_type', 'outbound')
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .lt('retries_count', maxRetries);
    
    if (error) {
      throw new Error(`Error fetching failed messages: ${error.message}`);
    }
    
    if (!failedMessages || failedMessages.length === 0) {
      logger.info('No failed messages found to retry');
      return;
    }
    
    logger.info(`Found ${failedMessages.length} failed messages to retry`);
    
    // Process each failed message
    for (const message of failedMessages) {
      try {
        const customer = message.service_visits.customers;
        const serviceVisit = message.service_visits;
        
        // Resend the message
        const newMessage = await twilioService.client.messages.create({
          body: message.message_body,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: customer.phone,
          statusCallback: process.env.BASE_URL + '/api/webhooks/twilio/status',
        });
        
        // Log the retry
        await supabaseService.logMessage({
          service_visit_id: serviceVisit.id,
          sent_at: new Date(),
          status: 'sent',
          twilio_sid: newMessage.sid,
          message_body: message.message_body,
          message_type: 'outbound',
          message_step: message.message_step,
          retries_count: (message.retries_count || 0) + 1,
        });
        
        logger.info(`Successfully retried message for service visit ${serviceVisit.id}`);
      } catch (error) {
        logger.error(`Error retrying message for service visit ${message.service_visit_id}:`, error);
        // Continue with next message even if one fails
      }
    }
    
    logger.info('Finished retrying failed messages');
  } catch (error) {
    logger.error('Error in retryFailedSurveys:', error);
    throw error;
  }
}

module.exports = {
  scheduleSurveys,
  retryFailedSurveys,
}; 