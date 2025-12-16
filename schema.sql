-- =========================================================
-- Open Movements – Postgres schema (AUTO IDs + UUID access codes)
-- =========================================================

-- UUID extension (needed only for access_codes)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- pg_cron extension (for scheduled tasks)
CREATE EXTENSION IF NOT EXISTS pg_cron;


-- CREATE database if not EXISTS openmovement;

-- =========================================================
-- ENUM TYPES
-- =========================================================

-- teacher profile status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_profile_status') THEN
        CREATE TYPE teacher_profile_status AS ENUM ('ACTIVE', 'INACTIVE', 'PLACED');
    END IF;
END$$;

-- school subscription status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM ('NO_SUBSCRIPTION','TRIAL', 'ACTIVE', 'EXPIRED');
    END IF;
END$$;
-- school subscription plan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
        CREATE TYPE subscription_plan AS ENUM ('BASIC', 'PRO', 'ULTIMATE');
    END IF;
END$$;

-- trial access code status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_code_status') THEN
        CREATE TYPE access_code_status AS ENUM ('UNUSED', 'ACTIVE', 'EXPIRED');
    END IF;
END$$;

-- full profile request status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
        CREATE TYPE request_status AS ENUM (
            'PENDING',
            'TEACHER_CONTACTED',
            'TEACHER_ACCEPTED',
            'TEACHER_DECLINED',
            'CLOSED'
        );
    END IF;
END$$;



CREATE OR REPLACE FUNCTION archive_teacher_function()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO archived_teachers (
        original_teacher_id, teacher_code, full_name, email, phone, cv_link,
        current_job_title, subjects, highest_qualification, current_country,
        current_region, visa_status, notice_period, will_move_sem1,
        will_move_sem2, years_experience, preferred_regions,
        profile_status, is_visible_in_school_portal,
        original_created_at, original_updated_at
    )
    VALUES (
        OLD.id, OLD.teacher_code, OLD.full_name, OLD.email, OLD.phone, OLD.cv_link,
        OLD.current_job_title, OLD.subjects, OLD.highest_qualification, OLD.current_country,
        OLD.current_region, OLD.visa_status, OLD.notice_period, OLD.will_move_sem1,
        OLD.will_move_sem2, OLD.years_experience, OLD.preferred_regions,
        OLD.profile_status, OLD.is_visible_in_school_portal,
        OLD.created_at, OLD.updated_at
    );
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- TABLE: schools
-- =========================================================

CREATE TABLE IF NOT EXISTS schools (
    id                      BIGSERIAL PRIMARY KEY,       -- AUTO INCREMENT
    -- school_code             TEXT UNIQUE NOT NULL,        -- internal code like OM-S0001

    name                    TEXT NOT NULL,
    contact_name            TEXT NOT NULL,
    email                   TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    website                 TEXT DEFAULT NULL,
    country                 TEXT,
    region                  TEXT,
    about                   TEXT DEFAULT NULL,
    phone                   TEXT DEFAULT NULL,
    city                    TEXT DEFAULT NULL,
    address                 TEXT DEFAULT NULL,
    subscription_status     subscription_status NOT NULL DEFAULT 'NO_SUBSCRIPTION',
    subscription_plan       subscription_plan DEFAULT NULL,
    subscription_started_at TIMESTAMPTZ DEFAULT NULL,
    subscription_end_at     TIMESTAMPTZ DEFAULT NULL,
    verify_token            TEXT DEFAULT uuid_generate_v4(),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified                BOOLEAN DEFAULT FALSE,
    forgot_password_token    TEXT DEFAULT NULL,
    forgot_password_expires_at TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_schools_subscription_status
    ON schools (subscription_status);

SELECT cron.schedule(
    'update-subscription-status',
    '0 * * * *',  -- every hour; use '0 0 * * *' for once per day
$$
    UPDATE schools
    SET subscription_status = 'EXPIRED'
    WHERE subscription_end_at < NOW()
      AND subscription_status != 'EXPIRED';
$$
);


-- =========================================================
-- TABLE: teachers
-- =========================================================

CREATE TABLE IF NOT EXISTS teachers (
    id                          BIGSERIAL PRIMARY KEY,          -- AUTO INCREMENT
    teacher_code                TEXT UNIQUE NOT NULL,           -- OM-TXXXXX visible to schools

    full_name                   TEXT NOT NULL,
    email                       TEXT NOT NULL,
    phone                       TEXT,
    cv_link                     TEXT,

    current_job_title           TEXT,
    subjects                    TEXT,
    highest_qualification       TEXT,

    current_country             TEXT,
    current_region              TEXT,
    visa_status                 TEXT,
    notice_period               TEXT,

    will_move_sem1              BOOLEAN NOT NULL DEFAULT FALSE,
    will_move_sem2              BOOLEAN NOT NULL DEFAULT FALSE,
    years_experience            INTEGER,

    preferred_regions           TEXT,

    -- salary_min                  NUMERIC(10,2),
    -- salary_max                  NUMERIC(10,2),

    -- category                    TEXT,

    current_school_name         TEXT,

    profile_status              teacher_profile_status NOT NULL DEFAULT 'ACTIVE',
    is_visible_in_school_portal BOOLEAN NOT NULL DEFAULT TRUE,

    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teachers_visible
    ON teachers (is_visible_in_school_portal, profile_status);


-- =========================================================
-- TABLE: archived_teachers
-- =========================================================

CREATE TABLE archived_teachers (
    archive_id              BIGSERIAL PRIMARY KEY,
    original_teacher_id     BIGINT,                 -- The ID from the main table
    teacher_code            TEXT,

    full_name               TEXT,
    email                   TEXT,
    phone                   TEXT,
    cv_link                 TEXT,

    current_job_title       TEXT,
    subjects                TEXT,
    highest_qualification   TEXT,

    current_country         TEXT,
    current_region          TEXT,
    visa_status             TEXT,
    notice_period           TEXT,

    will_move_sem1          BOOLEAN,
    will_move_sem2          BOOLEAN,
    years_experience        INTEGER,

    preferred_regions       TEXT,

    -- category             TEXT,

    profile_status          TEXT,
    is_visible_in_school_portal BOOLEAN,

    original_created_at     TIMESTAMPTZ,
    original_updated_at     TIMESTAMPTZ,

    archived_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trigger_archive_teacher
BEFORE DELETE ON teachers
FOR EACH ROW
EXECUTE FUNCTION archive_teacher_function();

-- =========================================================
-- TABLE: access_codes (24h trial codes, UUID ONLY)
-- =========================================================

CREATE TABLE IF NOT EXISTS access_codes (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),   -- UUID stays
    code           TEXT NOT NULL UNIQUE,                          -- e.g. ABCD1234

    school_id      BIGINT REFERENCES schools(id) ON DELETE SET NULL,

    status         access_code_status NOT NULL DEFAULT 'UNUSED',

    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    first_used_at  TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_access_codes_status ON access_codes (status);

-- =========================================================
-- TABLE: requests (Full profile requests)
-- =========================================================

CREATE TABLE IF NOT EXISTS requests (
    id              BIGSERIAL PRIMARY KEY,           -- AUTO INCREMENT
    teacher_id      BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    school_id       BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,

    requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status          request_status NOT NULL DEFAULT 'PENDING',

    school_message  TEXT,
    admin_notes     TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_teacher_id ON requests (teacher_id);
CREATE INDEX IF NOT EXISTS idx_requests_school_id ON requests (school_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);

-- =========================================================
-- TABLE: teacher_views (analytics log)
-- =========================================================

CREATE TABLE IF NOT EXISTS teacher_views (
    id           BIGSERIAL PRIMARY KEY,
    teacher_id   BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    school_id    BIGINT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_views_teacher_id ON teacher_views (teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_views_school_id ON teacher_views (school_id);


-- =========================================================
-- TABLE: admins (system administrators)
-- =========================================================

CREATE TABLE IF NOT EXISTS admins (
    id              BIGSERIAL PRIMARY KEY,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                  -- bcrypt hashed password
    role            TEXT NOT NULL DEFAULT 'ADMIN',  -- could extend later: SUPERADMIN, SUPPORT

    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
