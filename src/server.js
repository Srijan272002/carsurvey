// Main server file for the Voice-AI Survey System
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');
const cron = require('node-cron');

// Import route handlers
const surveyRoutes = require('./routes/surveyRoutes');
const customerRoutes = require('./routes/customerRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

// Import services
const schedulerService = require('./services/schedulerService');
const { createLogger } = require('./utils/logger');

// Initialize logger
const logger = createLogger();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);
  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message || 'An unexpected error occurred',
  });
});

// Routes
app.use('/api/surveys', surveyRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Car Dealership Voice-AI Survey API',
    version: '1.0.0',
    status: 'running',
  });
});

// Schedule the daily survey job
// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  try {
    logger.info('Running scheduled survey job');
    await schedulerService.scheduleSurveys();
    logger.info('Scheduled survey job completed');
  } catch (error) {
    logger.error('Error in scheduled survey job:', error);
  }
});

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...');
  logger.error(err.name, err.message);
  // Close server & exit process
  process.exit(1);
});

module.exports = app; // For testing purposes 