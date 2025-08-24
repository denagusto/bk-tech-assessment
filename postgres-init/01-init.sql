-- PostgreSQL initialization script for Flash Sale system
-- This script runs automatically when the postgres container starts

-- Create the flash_sale database if it doesn't exist
-- (This is usually handled by POSTGRES_DB environment variable, but this ensures it)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a function to check if database exists
CREATE OR REPLACE FUNCTION create_database_if_not_exists(db_name text)
RETURNS void AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = db_name) THEN
        EXECUTE format('CREATE DATABASE %I', db_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Call the function to ensure database exists
SELECT create_database_if_not_exists('flash_sale');

-- Grant all privileges to postgres user
GRANT ALL PRIVILEGES ON DATABASE flash_sale TO postgres;

-- Connect to the flash_sale database
\c flash_sale;

-- Create UUID extension in the flash_sale database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization completed successfully for flash_sale database';
END $$;
