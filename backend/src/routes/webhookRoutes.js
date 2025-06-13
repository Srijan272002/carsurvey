// Webhook routes for handling Twilio SMS callbacks
const express = require('express');
const router = express.Router();
const { createLogger } = require('../utils/logger');
const twilioService = require('../services/twilioService');
const supabaseService = require('../services/supabaseService');

const logger = createLogger();

/**
 * Twilio webhook for handling incoming SMS messages
 */
router.post('/twilio/message', async (req, res) => {
  try {
    logger.info('Received Twilio SMS webhook');
    
    // Extract data from request
    const messageSid = req.body.MessageSid;
    const from = req.body.From;
    const body = req.body.Body;
    
    logger.info(`Incoming SMS from ${from}: "${body}"`);
    
    // Process the incoming message
    await twilioService.processIncomingSMS(messageSid, from, body);
    
    // Return an empty TwiML response (no reply via webhook)
    const twiml = new (require('twilio').twiml.MessagingResponse)();
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    logger.error('Error in Twilio SMS webhook:', error);
    
    // Return an empty response in case of error
    const twiml = new (require('twilio').twiml.MessagingResponse)();
    res.type('text/xml');
    res.send(twiml.toString());
  }
});

/**
 * Twilio webhook for message status updates
 */
router.post('/twilio/status', async (req, res) => {
  try {
    logger.info('Received Twilio message status webhook');
    
    // Extract data from request
    const messageSid = req.body.MessageSid;
    const messageStatus = req.body.MessageStatus;
    
    // Handle the status update
    await twilioService.handleMessageStatusCallback(messageSid, messageStatus);
    
    res.status(200).send('Status update received');
  } catch (error) {
    logger.error('Error in Twilio status webhook:', error);
    res.status(500).send('Error processing status update');
  }
});

module.exports = router; 