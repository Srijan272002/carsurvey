// Supabase Service for database interactions
const { createClient } = require('@supabase/supabase-js');
const { createLogger } = require('../utils/logger');

const logger = createLogger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get service visits that are due for a follow-up survey
 * @returns {Promise<Array>} Array of service visits
 */
async function getServiceVisitsDueForSurvey() {
  try {
    // Get service visits from the last 24-48 hours that don't have a survey yet
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const { data, error } = await supabase
      .from('service_visits')
      .select(`
        *,
        customers(id, first_name, last_name, phone, email, preferred_language),
        surveys(id, survey_completed)
      `)
      .gte('completed_at', twoDaysAgo.toISOString())
      .lte('completed_at', yesterday.toISOString())
      .is('surveys.id', null); // Only get visits without a survey
    
    if (error) {
      throw new Error(`Error fetching service visits: ${error.message}`);
    }
    
    return data || [];
  } catch (error) {
    logger.error('Error getting service visits due for survey:', error);
    throw error;
  }
}

/**
 * Create a new survey record
 * @param {string} serviceVisitId - The ID of the service visit
 * @returns {Promise<Object>} The created survey
 */
async function createSurvey(serviceVisitId) {
  try {
    const { data, error } = await supabase
      .from('surveys')
      .insert({
        service_visit_id: serviceVisitId,
        call_timestamp: new Date().toISOString(),
        survey_completed: false,
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error creating survey: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error creating survey:', error);
    throw error;
  }
}

/**
 * Log a message in the database
 * @param {Object} messageData - Data about the message
 * @returns {Promise<Object>} The created message log
 */
async function logMessage(messageData) {
  try {
    const { data, error } = await supabase
      .from('message_logs')
      .insert(messageData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error logging message: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error logging message:', error);
    throw error;
  }
}

/**
 * Update message status in the database
 * @param {string} messageSid - The Twilio message SID
 * @param {string} status - The message status
 * @returns {Promise<Object>} The updated message log
 */
async function updateMessageStatus(messageSid, status) {
  try {
    const { data, error } = await supabase
      .from('message_logs')
      .update({
        status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('twilio_sid', messageSid)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating message status: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating message status:', error);
    throw error;
  }
}

/**
 * Get conversation history by phone number
 * @param {string} phoneNumber - The customer's phone number
 * @returns {Promise<Object>} The service visit and conversation
 */
async function getConversationByPhone(phoneNumber) {
  try {
    // First, find the customer by phone number
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phoneNumber)
      .single();
    
    if (customerError) {
      throw new Error(`Error finding customer by phone: ${customerError.message}`);
    }
    
    // Find the most recent service visit for this customer
    const { data: serviceVisit, error: visitError } = await supabase
      .from('service_visits')
      .select(`
        *,
        surveys(id, conversation, survey_completed)
      `)
      .eq('customer_id', customer.id)
      .order('service_date', { ascending: false })
      .limit(1)
      .single();
    
    if (visitError) {
      throw new Error(`Error finding service visit: ${visitError.message}`);
    }
    
    // Get or initialize conversation
    let conversation = [];
    if (serviceVisit.surveys && serviceVisit.surveys.length > 0 && serviceVisit.surveys[0].conversation) {
      conversation = serviceVisit.surveys[0].conversation;
    } else {
      // Initialize conversation with AI greeting
      conversation = [
        {
          speaker: 'ai',
          text: 'Hello from Premium Motors! We would like your feedback on your recent service visit. On a scale of 0-10, how would you rate your overall satisfaction with our service?'
        }
      ];
    }
    
    return { serviceVisit, conversation };
  } catch (error) {
    logger.error('Error getting conversation by phone:', error);
    throw error;
  }
}

/**
 * Update conversation in the database
 * @param {string} serviceVisitId - The service visit ID
 * @param {Array} conversation - The updated conversation
 * @returns {Promise<Object>} The updated survey
 */
async function updateConversation(serviceVisitId, conversation) {
  try {
    // First, get the survey ID for this service visit
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id')
      .eq('service_visit_id', serviceVisitId)
      .single();
    
    if (surveyError) {
      throw new Error(`Error finding survey: ${surveyError.message}`);
    }
    
    // Update the survey with the conversation
    const { data, error } = await supabase
      .from('surveys')
      .update({
        conversation: conversation,
        updated_at: new Date().toISOString(),
      })
      .eq('id', survey.id)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating conversation: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating conversation:', error);
    throw error;
  }
}

/**
 * Log a call in the database
 * @param {Object} callData - Data about the call
 * @returns {Promise<Object>} The created call log
 */
async function logCall(callData) {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .insert(callData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error logging call: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error logging call:', error);
    throw error;
  }
}

/**
 * Update call status in the database
 * @param {string} callSid - The Twilio call SID
 * @param {string} status - The call status
 * @returns {Promise<Object>} The updated call log
 */
async function updateCallStatus(callSid, status) {
  try {
    const now = new Date();
    
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        call_status: status,
        ...(status === 'completed' && { call_end: now.toISOString() }),
      })
      .eq('twilio_sid', callSid)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating call status: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating call status:', error);
    throw error;
  }
}

/**
 * Update call recording URL in the database
 * @param {string} callSid - The Twilio call SID
 * @param {string} recordingUrl - The recording URL
 * @returns {Promise<Object>} The updated call log
 */
async function updateCallRecording(callSid, recordingUrl) {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        recording_url: recordingUrl,
      })
      .eq('twilio_sid', callSid)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating call recording: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating call recording:', error);
    throw error;
  }
}

/**
 * Update call transcription in the database
 * @param {string} callSid - The Twilio call SID
 * @param {Array} conversation - The conversation transcript
 * @returns {Promise<Object>} The updated call log
 */
async function updateCallTranscription(callSid, conversation) {
  try {
    // Get the call record to find the associated service visit
    const { data: callRecord, error: callError } = await supabase
      .from('call_logs')
      .select('service_visit_id')
      .eq('twilio_sid', callSid)
      .single();
    
    if (callError) {
      throw new Error(`Error finding call record: ${callError.message}`);
    }
    
    // Update the call log with the transcription
    const { data, error } = await supabase
      .from('call_logs')
      .update({
        transcription: conversation,
      })
      .eq('twilio_sid', callSid)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating call transcription: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating call transcription:', error);
    throw error;
  }
}

/**
 * Get a call by its Twilio SID
 * @param {string} callSid - The Twilio call SID
 * @returns {Promise<Object>} The call record
 */
async function getCallBySid(callSid) {
  try {
    const { data, error } = await supabase
      .from('call_logs')
      .select('*')
      .eq('twilio_sid', callSid)
      .single();
    
    if (error) {
      throw new Error(`Error finding call record: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error getting call by SID:', error);
    throw error;
  }
}

/**
 * Update survey status
 * @param {string} serviceVisitId - The service visit ID
 * @param {boolean} completed - Whether the survey is completed
 * @returns {Promise<Object>} The updated survey
 */
async function updateSurveyStatus(serviceVisitId, completed) {
  try {
    const { data, error } = await supabase
      .from('surveys')
      .update({
        survey_completed: completed,
      })
      .eq('service_visit_id', serviceVisitId)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error updating survey status: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    logger.error('Error updating survey status:', error);
    throw error;
  }
}

/**
 * Save survey results
 * @param {string} serviceVisitId - The service visit ID
 * @param {Object} surveyData - The structured survey data
 * @returns {Promise<Object>} The updated survey
 */
async function saveSurveyResults(serviceVisitId, surveyData) {
  try {
    // First, get the survey ID for this service visit
    const { data: survey, error: surveyError } = await supabase
      .from('surveys')
      .select('id')
      .eq('service_visit_id', serviceVisitId)
      .single();
    
    if (surveyError) {
      throw new Error(`Error finding survey record: ${surveyError.message}`);
    }
    
    const surveyId = survey.id;
    
    // Update the survey with ratings and callback flag
    const { data: updatedSurvey, error: updateError } = await supabase
      .from('surveys')
      .update({
        survey_completed: true,
        language_used: surveyData.preferred_language,
        overall_satisfaction: surveyData.ratings.overall_satisfaction,
        workmanship_quality: surveyData.ratings.workmanship_quality,
        service_timeliness: surveyData.ratings.service_timeliness,
        staff_friendliness: surveyData.ratings.staff_friendliness,
        callback_needed: surveyData.callback_needed,
      })
      .eq('id', surveyId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(`Error updating survey: ${updateError.message}`);
    }
    
    // Save follow-up items
    const followUpPromises = [];
    
    // Process billing disputes
    if (surveyData.follow_up_items.billing_disputes && surveyData.follow_up_items.billing_disputes.length > 0) {
      for (const issue of surveyData.follow_up_items.billing_disputes) {
        followUpPromises.push(
          supabase.from('follow_up_items').insert({
            survey_id: surveyId,
            issue_type: 'billing_dispute',
            issue_description: issue,
          })
        );
      }
    }
    
    // Process mechanical issues
    if (surveyData.follow_up_items.mechanical_issues && surveyData.follow_up_items.mechanical_issues.length > 0) {
      for (const issue of surveyData.follow_up_items.mechanical_issues) {
        followUpPromises.push(
          supabase.from('follow_up_items').insert({
            survey_id: surveyId,
            issue_type: 'mechanical_issue',
            issue_description: issue,
          })
        );
      }
    }
    
    // Process warranty questions
    if (surveyData.follow_up_items.warranty_questions && surveyData.follow_up_items.warranty_questions.length > 0) {
      for (const issue of surveyData.follow_up_items.warranty_questions) {
        followUpPromises.push(
          supabase.from('follow_up_items').insert({
            survey_id: surveyId,
            issue_type: 'warranty_question',
            issue_description: issue,
          })
        );
      }
    }
    
    // Process service logistics
    if (surveyData.follow_up_items.service_logistics && surveyData.follow_up_items.service_logistics.length > 0) {
      for (const issue of surveyData.follow_up_items.service_logistics) {
        followUpPromises.push(
          supabase.from('follow_up_items').insert({
            survey_id: surveyId,
            issue_type: 'service_logistics',
            issue_description: issue,
          })
        );
      }
    }
    
    // Process safety concerns
    if (surveyData.follow_up_items.safety_concerns && surveyData.follow_up_items.safety_concerns.length > 0) {
      for (const issue of surveyData.follow_up_items.safety_concerns) {
        followUpPromises.push(
          supabase.from('follow_up_items').insert({
            survey_id: surveyId,
            issue_type: 'safety_concern',
            issue_description: issue,
          })
        );
      }
    }
    
    // Save positive remarks
    if (surveyData.positive_remarks && surveyData.positive_remarks.length > 0) {
      for (const remark of surveyData.positive_remarks) {
        followUpPromises.push(
          supabase.from('positive_remarks').insert({
            survey_id: surveyId,
            employee_name: remark.employee,
            comment: remark.comment,
          })
        );
      }
    }
    
    // Wait for all follow-up items to be saved
    await Promise.all(followUpPromises);
    
    return updatedSurvey;
  } catch (error) {
    logger.error('Error saving survey results:', error);
    throw error;
  }
}

module.exports = {
  getServiceVisitsDueForSurvey,
  createSurvey,
  logCall,
  updateCallStatus,
  updateCallRecording,
  updateCallTranscription,
  getCallBySid,
  updateSurveyStatus,
  saveSurveyResults,
  // New methods for SMS handling
  logMessage,
  updateMessageStatus,
  getConversationByPhone,
  updateConversation,
  supabase, // Expose the supabase client for direct access if needed
}; 