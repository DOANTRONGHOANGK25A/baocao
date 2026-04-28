DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS chain_logs;
DROP TABLE IF EXISTS record_files;
DROP TABLE IF EXISTS records;
DROP TABLE IF EXISTS users;

-- 1) Users
CREATE TABLE users (
  id               BIGSERIAL PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'STAFF' CHECK (role IN ('ADMIN','STAFF','MANAGER')),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2) Records
CREATE TABLE records (
  id            BIGSERIAL PRIMARY KEY,
  record_code   TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  category      TEXT,
  owner_name    TEXT,
  description   TEXT,
  status        TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','CONFIRMED','REJECTED','REVOKED')),
  created_by    BIGINT REFERENCES users(id),
  approved_by   BIGINT REFERENCES users(id),
  revoke_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 3) Record files
CREATE TABLE record_files (
  id          BIGSERIAL PRIMARY KEY,
  record_id   BIGINT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  filename    TEXT,
  mime_type   TEXT,
  size_bytes  INT,
  data        BYTEA NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Chain logs
CREATE TABLE chain_logs (
  id             BIGSERIAL PRIMARY KEY,
  record_id      BIGINT NOT NULL REFERENCES records(id) ON DELETE CASCADE,
  actor_id       BIGINT REFERENCES users(id),
  action         TEXT NOT NULL,
  tx_id          TEXT,
  record_hash    TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 5) Audit logs
CREATE TABLE audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT REFERENCES users(id),
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed users (mật khẩu: 123456)
INSERT INTO users (username, password_hash, role) VALUES
  ('admin',     '$2b$12$YgKhuefh2FSRegI1wE62ZOdyxz0SKQgoiGbR/BdWZv64pgbcjMKNy', 'ADMIN'),
  ('nhanvien1', '$2b$12$YgKhuefh2FSRegI1wE62ZOdyxz0SKQgoiGbR/BdWZv64pgbcjMKNy', 'STAFF'),
  ('quanly1',   '$2b$12$YgKhuefh2FSRegI1wE62ZOdyxz0SKQgoiGbR/BdWZv64pgbcjMKNy', 'MANAGER')
ON CONFLICT (username) DO NOTHING;
