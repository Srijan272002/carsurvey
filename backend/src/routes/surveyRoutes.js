// Survey routes for managing survey data
const express = require('express');
const router = express.Router();
const { createLogger } = require('../utils/logger');
const { createClient } = require('@supabase/supabase-js');

const logger = createLogger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get all surveys with optional filters
 */
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/surveys');
    
    // Extract query parameters for filtering
    const { 
      completed, 
      callback_needed, 
      from_date, 
      to_date,
      min_rating,
      max_rating
    } = req.query;
    
    // Start building query
    let query = supabase
      .from('surveys')
      .select(`
        *,
        service_visits(
          id,
          service_date,
          vehicle_make,
          vehicle_model,
          vehicle_year,
          vin
        ),
        follow_up_items(*),
        positive_remarks(*)
      `);
    
    // Apply filters if provided
    if (completed !== undefined) {
      query = query.eq('survey_completed', completed === 'true');
    }
    
    if (callback_needed !== undefined) {
      query = query.eq('callback_needed', callback_needed === 'true');
    }
    
    if (from_date) {
      query = query.gte('call_timestamp', from_date);
    }
    
    if (to_date) {
      query = query.lte('call_timestamp', to_date);
    }
    
    if (min_rating) {
      query = query.gte('overall_satisfaction', parseInt(min_rating));
    }
    
    if (max_rating) {
      query = query.lte('overall_satisfaction', parseInt(max_rating));
    }
    
    // Execute the query
    const { data, error } = await query;
    
    if (error) {
      logger.error('Error fetching surveys:', error);
      return res.status(500).json({ error: 'Failed to fetch surveys' });
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    logger.error('Error in GET /api/surveys:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get a single survey by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`GET /api/surveys/${id}`);
    
    const { data, error } = await supabase
      .from('surveys')
      .select(`
        *,
        service_visits(
          *,
          customers(id, first_name, last_name, phone, email)
        ),
        follow_up_items(*),
        positive_remarks(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      logger.error(`Error fetching survey ${id}:`, error);
      return res.status(404).json({ error: 'Survey not found' });
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    logger.error(`Error in GET /api/surveys/${req.params.id}:`, error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Update callback status for a survey
 */
router.patch('/:id/callback', async (req, res) => {
  try {
    const { id } = req.params;
    const { callback_completed, callback_notes } = req.body;
    
    logger.info(`PATCH /api/surveys/${id}/callback`);
    
    if (callback_completed === undefined) {
      return res.status(400).json({ error: 'callback_completed is required' });
    }
    
    const { data, error } = await supabase
      .from('surveys')
      .update({
        callback_completed,
        callback_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error(`Error updating callback status for survey ${id}:`, error);
      return res.status(500).json({ error: 'Failed to update callback status' });
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    logger.error(`Error in PATCH /api/surveys/${req.params.id}/callback:`, error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get follow-up items for a survey
 */
router.get('/:id/follow-up-items', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`GET /api/surveys/${id}/follow-up-items`);
    
    const { data, error } = await supabase
      .from('follow_up_items')
      .select('*')
      .eq('survey_id', id);
    
    if (error) {
      logger.error(`Error fetching follow-up items for survey ${id}:`, error);
      return res.status(500).json({ error: 'Failed to fetch follow-up items' });
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    logger.error(`Error in GET /api/surveys/${req.params.id}/follow-up-items:`, error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Update a follow-up item status
 */
router.patch('/follow-up-items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assigned_to, resolved_at } = req.body;
    
    logger.info(`PATCH /api/surveys/follow-up-items/${id}`);
    
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    
    const { data, error } = await supabase
      .from('follow_up_items')
      .update({
        status,
        assigned_to,
        resolved_at: resolved_at || (status === 'resolved' ? new Date().toISOString() : null),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      logger.error(`Error updating follow-up item ${id}:`, error);
      return res.status(500).json({ error: 'Failed to update follow-up item' });
    }
    
    return res.status(200).json({ data });
  } catch (error) {
    logger.error(`Error in PATCH /api/surveys/follow-up-items/${req.params.id}:`, error);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Get statistics and summary data for surveys
 */
router.get('/stats/summary', async (req, res) => {
  try {
    logger.info('GET /api/surveys/stats/summary');
    
    // Get overall statistics
    const { data: surveyCount, error: countError } = await supabase
      .from('surveys')
      .select('id', { count: 'exact' });
    
    if (countError) {
      logger.error('Error fetching survey count:', countError);
      return res.status(500).json({ error: 'Failed to fetch survey statistics' });
    }
    
    // Get average ratings
    const { data: ratingData, error: ratingError } = await supabase
      .rpc('get_average_ratings');
    
    if (ratingError) {
      logger.error('Error fetching average ratings:', ratingError);
      return res.status(500).json({ error: 'Failed to fetch rating statistics' });
    }
    
    // Get callback needed count
    const { data: callbackData, error: callbackError } = await supabase
      .from('surveys')
      .select('id', { count: 'exact' })
      .eq('callback_needed', true);
    
    if (callbackError) {
      logger.error('Error fetching callback count:', callbackError);
      return res.status(500).json({ error: 'Failed to fetch callback statistics' });
    }
    
    // Get follow-up item counts by type
    const { data: followUpData, error: followUpError } = await supabase
      .rpc('get_follow_up_counts_by_type');
    
    if (followUpError) {
      logger.error('Error fetching follow-up counts:', followUpError);
      return res.status(500).json({ error: 'Failed to fetch follow-up statistics' });
    }
    
    // Compile all statistics
    const stats = {
      total_surveys: surveyCount.length,
      average_ratings: ratingData || {
        overall_satisfaction: 0,
        workmanship_quality: 0,
        service_timeliness: 0,
        staff_friendliness: 0
      },
      callback_needed_count: callbackData.length,
      follow_up_counts: followUpData || []
    };
    
    return res.status(200).json({ data: stats });
  } catch (error) {
    logger.error('Error in GET /api/surveys/stats/summary:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 