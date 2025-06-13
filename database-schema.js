// Supabase Database Schema for Car Dealership Voice-AI Survey System
// This file provides the schema definitions for setting up Supabase tables

// Example of how to create these tables using Supabase JS client
// You would run these in your initialization scripts

/*
  Customers Table - Stores information about customers who have received service
*/
const createCustomersTable = `
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  preferred_language TEXT DEFAULT 'English',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
`;

/*
  Service Visits Table - Records of customer service visits
*/
const createServiceVisitsTable = `
CREATE TABLE IF NOT EXISTS service_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  service_date TIMESTAMP WITH TIME ZONE NOT NULL,
  service_type TEXT NOT NULL,
  vehicle_make TEXT NOT NULL,
  vehicle_model TEXT NOT NULL,
  vehicle_year INTEGER NOT NULL,
  vin TEXT NOT NULL,
  service_advisor TEXT,
  technician TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_visits_customer ON service_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_visits_date ON service_visits(service_date);
CREATE INDEX IF NOT EXISTS idx_service_visits_vin ON service_visits(vin);
`;

/*
  Surveys Table - Stores survey responses from customers
*/
const createSurveysTable = `
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_visit_id UUID REFERENCES service_visits(id) NOT NULL,
  call_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  survey_completed BOOLEAN DEFAULT FALSE,
  language_used TEXT DEFAULT 'English',
  overall_satisfaction INTEGER,
  workmanship_quality INTEGER,
  service_timeliness INTEGER,
  staff_friendliness INTEGER,
  callback_needed BOOLEAN DEFAULT FALSE,
  callback_completed BOOLEAN DEFAULT FALSE,
  callback_notes TEXT,
  conversation JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_surveys_service_visit ON surveys(service_visit_id);
CREATE INDEX IF NOT EXISTS idx_surveys_callback ON surveys(callback_needed);
`;

/*
  Survey Follow-Up Items Table - Tracks specific issues mentioned in surveys
*/
const createFollowUpItemsTable = `
CREATE TABLE IF NOT EXISTS follow_up_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID REFERENCES surveys(id) NOT NULL,
  issue_type TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_follow_up_items_survey ON follow_up_items(survey_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_items_type ON follow_up_items(issue_type);
CREATE INDEX IF NOT EXISTS idx_follow_up_items_status ON follow_up_items(status);
`;

/*
  Positive Remarks Table - Tracks compliments and staff recognition
*/
const createPositiveRemarksTable = `
CREATE TABLE IF NOT EXISTS positive_remarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id UUID REFERENCES surveys(id) NOT NULL,
  employee_name TEXT,
  employee_description TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_positive_remarks_survey ON positive_remarks(survey_id);
CREATE INDEX IF NOT EXISTS idx_positive_remarks_employee ON positive_remarks(employee_name);
`;

/*
  Message Logs Table - Detailed logs of every SMS message
*/
const createMessageLogsTable = `
CREATE TABLE IF NOT EXISTS message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_visit_id UUID REFERENCES service_visits(id),
  twilio_sid TEXT,
  message_body TEXT NOT NULL,
  message_type TEXT NOT NULL, 
  message_step TEXT,
  from_number TEXT,
  to_number TEXT,
  status TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  retries_count INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_logs_service_visit ON message_logs(service_visit_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_twilio_sid ON message_logs(twilio_sid);
CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
CREATE INDEX IF NOT EXISTS idx_message_logs_from ON message_logs(from_number);
`;

// Example usage with Supabase client
/*
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function setupDatabase() {
  // Execute each of the schema creation scripts
  await supabase.rpc('pgexec', { query: createCustomersTable })
  await supabase.rpc('pgexec', { query: createServiceVisitsTable })
  await supabase.rpc('pgexec', { query: createSurveysTable })
  await supabase.rpc('pgexec', { query: createFollowUpItemsTable })
  await supabase.rpc('pgexec', { query: createPositiveRemarksTable })
  await supabase.rpc('pgexec', { query: createMessageLogsTable })
  
  console.log('Database schema created successfully')
}

setupDatabase().catch(console.error)
*/ 