/*
  Neon PostgreSQL schema for Opti Wifi application.
  This file can be used with Neon CLI to provision the database.
*/

-- Users table (basic authentication placeholder)
CREATE TABLE IF NOT EXISTS "users" (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tickets table (core domain model)
CREATE TABLE IF NOT EXISTS "tickets" (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "users"(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- History table for ticket status changes
CREATE TABLE IF NOT EXISTS "ticket_history" (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER REFERENCES "tickets"(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON "tickets"(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_history_ticket_id ON "ticket_history"(ticket_id);
