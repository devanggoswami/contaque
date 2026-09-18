-- Lead OS PostgreSQL Production Schema

CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    location VARCHAR(255) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    target_count INTEGER NOT NULL,
    fetched_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    place_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    address TEXT,
    phone VARCHAR(50),
    website TEXT,
    category VARCHAR(100),
    source_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT leads_job_place_unique UNIQUE (job_id, place_id)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_leads_job_id ON leads(job_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
