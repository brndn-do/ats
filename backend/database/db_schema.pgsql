DROP TABLE IF EXISTS resumes, users, jobs, applications CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  pwd_hash VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resumes (
  id SERIAL PRIMARY KEY,
  original_filename VARCHAR(255) NOT NULL,
  object_key VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  applicant_name VARCHAR(255) NOT NULL,
  applicant_email VARCHAR(255) NOT NULL,
  score INTEGER DEFAULT -1,
  job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
  resume_id INTEGER REFERENCES resumes(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, applicant_email)
);

-- Seed the database with a default admin user
-- username: admin
-- password: password
INSERT INTO users (username, email, pwd_hash, is_admin)
VALUES (
  'admin',
  'admin@example.com',
  '$2b$12$Cl7VsBb.W1ZIm.67vhUckOjQyjNiy0NCo0CT9ApisBRH6Nl180LRq', -- bcrypt.hashSync('password', 12)
  TRUE
);