# Car Dealership Voice-AI Survey System

A Node.js-based automated survey system that sends text messages to customers within 24 hours of a service visit at a car dealership, collecting feedback and providing structured data for analysis.

## Project Overview

This system automatically sends SMS surveys to customers after their service visits, analyzing responses using Google's Gemini AI to:

- Capture satisfaction ratings (0-10) for overall satisfaction, workmanship, timeliness, and staff friendliness
- Extract follow-up items such as billing disputes, mechanical issues, warranty questions, etc.
- Tag positive remarks about staff for employee recognition
- Detect and switch between English and Spanish based on customer responses
- Flag surveys that need callbacks based on low ratings or specific issues

## Technology Stack

- **Backend**: Node.js with Express
- **Database**: Supabase
- **AI/ML**: Google Gemini for natural language processing
- **Messaging**: Twilio SMS (instead of voice calls)
- **Scheduler**: Node-cron for scheduling surveys
- **Logging**: Winston

## Prerequisites

- Node.js (v16 or later)
- Supabase account
- Google Gemini API key
- Twilio account (free trial account is sufficient for SMS)

## Setup Instructions

1. **Clone the repository**

```bash
git clone <repository-url>
cd car-dealership-survey-system
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment configuration**

Copy the example environment file and update it with your credentials:

```bash
cp .env.example .env
```

Update the `.env` file with your:
- Supabase URL and keys
- Google Gemini API key
- Twilio account SID, auth token, and phone number
- Other configuration options

4. **Database setup**

Run the database setup script to create the necessary tables in Supabase:

```bash
npm run setup-db
```

## Running the Server

Start the development server:

```bash
npm run dev
```

For production:

```bash
npm start
```

The server will run on port 3000 by default (configurable in .env).

## Important Note About Twilio Integration

This system originally used Twilio voice calls for surveys, but has been adapted to use SMS messaging instead. This change was made because:

1. Twilio offers free phone numbers for SMS in trial accounts
2. SMS can be more convenient for customers to respond at their own pace
3. Text-based surveys can be less intrusive than phone calls

### How the SMS Survey Works

Instead of making outbound calls, the system now:

1. Sends an initial SMS to the customer introducing the survey
2. Sends follow-up questions based on customer responses
3. Uses Gemini AI to process the text responses
4. Structures the data in the same JSON format as originally designed

## API Endpoints

### Survey Management

- `GET /api/surveys` - Get all surveys with optional filters
- `GET /api/surveys/:id` - Get a specific survey by ID
- `PATCH /api/surveys/:id/callback` - Update callback status
- `GET /api/surveys/stats/summary` - Get statistics and summary data

### Webhooks

- `POST /api/webhooks/twilio/message` - Handle incoming SMS messages
- `POST /api/webhooks/twilio/status` - Handle message status updates

## Project Structure

```
├── src/
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic
│   │   ├── geminiService.js    # AI processing
│   │   ├── twilioService.js    # Messaging service
│   │   ├── supabaseService.js  # Database operations
│   │   └── schedulerService.js # Survey scheduling
│   ├── utils/           # Utility functions
│   └── server.js        # Main application entry
├── scripts/             # Setup and utility scripts
├── .env                 # Environment variables (create from .env.example)
└── package.json         # Project dependencies
```

## Modifying for Voice Surveys

If you wish to use voice calls instead of SMS (requires purchasing a Twilio phone number):

1. Update the Twilio configuration in `.env`
2. Modify the `twilioService.js` file to use voice calls instead of messaging
3. Update the webhook routes to handle voice responses instead of SMS

## Troubleshooting

- **Database Connection Issues**: Verify your Supabase credentials and connection string
- **Twilio SMS Not Sending**: Check your Twilio account balance and verify your phone number is SMS-capable
- **AI Processing Errors**: Ensure your Google Gemini API key is valid and has sufficient quota

## License

[MIT License](LICENSE)

## Contact

For support or questions, please contact [your-contact-information] 