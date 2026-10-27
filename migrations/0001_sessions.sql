-- A visitor's sandbox: a session with a name and a role, the edits made in it and an audit
-- log of who did what. Everything belongs to a session and goes with it after 24 hours.
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'operator')),
  ip_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expires_at);
CREATE INDEX sessions_ip ON sessions (ip_hash, created_at);

CREATE TABLE edits (
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  capacity INTEGER,
  min_stable INTEGER,
  marginal_cost REAL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (session_id, unit_id)
);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  unit_id TEXT,
  detail TEXT NOT NULL
);
CREATE INDEX audit_by_session ON audit (session_id, id);
