# Premium Motors Survey System - Application Flow

## Overview

The Premium Motors Survey System is an automated solution for collecting customer feedback after service visits using SMS-based surveys powered by AI. The system processes customer responses, extracts structured data, and identifies cases requiring follow-up.

## System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│                 │     │                  │     │               │
│ Twilio SMS      │────▶│ Express Backend  │────▶│ Gemini API    │
│ Service         │     │ (Node.js)        │     │ (NLP Engine)  │
│                 │     │                  │     │               │
└─────────────────┘     └──────────────────┘     └───────┬───────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│                 │     │                  │     │               │
│ Admin Dashboard │◀────│ Backend APIs     │◀────│ Structured    │
│ (React)         │     │ (Node.js/Express)│     │ JSON Data     │
│                 │     │                  │     │               │
└─────────────────┘     └──────────────────┘     └───────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │                  │
                        │ Supabase         │
                        │ Database         │
                        │                  │
                        └──────────────────┘
```

## Application Flow

### 1. Survey Initiation
- **Trigger**: Customer completes a service visit at Premium Motors
- **Action**: System schedules an automated survey to be sent via SMS
- **Technology**: Node.js scheduler with Twilio SMS API integration

### 2. Customer Interaction
- **Trigger**: Customer receives SMS with survey link/questions
- **Action**: Customer responds to survey questions via SMS
- **Technology**: Twilio SMS service with webhook integration

### 3. Response Processing
- **Trigger**: Incoming SMS responses from customers
- **Action**: 
  - Twilio webhooks receive responses
  - Responses are processed by the Express backend
  - Complete conversation is sent to Gemini AI for analysis
- **Technology**: Express.js, Twilio webhooks, Google Gemini API

### 4. AI Analysis
- **Trigger**: Survey response data received by Gemini AI
- **Action**: 
  - AI processes natural language responses
  - Extracts structured data according to predefined format
  - Identifies ratings, issues, and follow-up items
  - Determines if callback is needed based on specific criteria
- **Technology**: Google Gemini with custom prompt engineering

### 5. Data Storage
- **Trigger**: Structured data received from Gemini AI
- **Action**: Store survey results, customer information, and service visit details
- **Technology**: Supabase database

### 6. Follow-up Flagging
- **Trigger**: Survey analysis indicates callback needed
- **Action**: Flag customer for follow-up based on criteria:
  - Any rating is 5 or lower
  - Billing dispute mentioned
  - Safety issue mentioned
  - Warranty clarification requested
- **Technology**: Backend business logic with database updates

### 7. Dashboard Visualization
- **Trigger**: Admin accesses the dashboard
- **Action**: 
  - Display survey statistics and analytics
  - Show customer information and service history
  - List surveys requiring follow-up
  - Provide detailed view of individual survey responses
- **Technology**: React frontend with Material UI components

## Key User Flows

### Customer Survey Experience
1. Receives SMS after service visit
2. Responds to survey questions via SMS
3. May switch languages if needed (system supports multilingual surveys)
4. Receives confirmation when survey is complete

### Service Manager Dashboard Experience
1. Logs into admin dashboard
2. Views summary statistics on the dashboard homepage
3. Reviews list of customers requiring callbacks
4. Accesses detailed survey responses
5. Manages customer information and service history

## Technical Implementation Details

### Backend (Node.js/Express)
- RESTful API endpoints for data access
- Twilio integration for SMS handling
- Gemini AI integration for NLP processing
- Scheduler for automated survey distribution
- Authentication and authorization

### Frontend (React)
- Dashboard with statistics and visualizations
- Customer management interface
- Service visit tracking
- Survey results viewing and management
- User authentication

### Database Schema
- Customers table
- Service Visits table
- Surveys table
- Survey Responses table
- Users table (for admin access)

### AI Processing
The system uses a carefully engineered prompt for Gemini AI:
```
You are a friendly automotive service survey assistant for Premium Motors. Follow these instructions precisely:

1. GREETING: Begin with a brief, courteous introduction.
2. COLLECT RATINGS: Ask the customer to rate on a scale of 0-10 for overall satisfaction, workmanship quality, timeliness, and staff friendliness.
3. FOLLOW-UP ITEMS: Identify billing concerns, mechanical issues, warranty questions, service logistics complaints, and safety concerns.
4. POSITIVE RECOGNITION: Note compliments and staff names mentioned positively.
5. LANGUAGE ADAPTATION: Continue in Spanish if the customer speaks Spanish.
6. OUTPUT STRUCTURE: Return a structured JSON object with ratings, follow-up items, positive remarks, preferred language, and callback flag.
7. CALLBACK FLAG: Set to true for low ratings, billing disputes, safety issues, or warranty questions.
8. CONVERSATION FLOW: Maintain natural conversation while collecting required data.
```

## Deployment Architecture
- Backend: Node.js server deployed on cloud infrastructure
- Frontend: React application served as static files
- Database: Supabase cloud database
- SMS Service: Twilio account with configured webhooks
- AI Processing: Google Gemini API with authentication 