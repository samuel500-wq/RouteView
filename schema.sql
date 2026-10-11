-- ============================================================
--  RouteView — full database schema
--  Target: MySQL 5.7+ / MariaDB 10.4+ (XAMPP default)
--  Safe to run repeatedly: drops and recreates all tables.
-- ============================================================

CREATE DATABASE IF NOT EXISTS routeview
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE routeview;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------- Drop in reverse dependency order ----------
DROP TABLE IF EXISTS ticket_redemptions;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS fares;
DROP TABLE IF EXISTS vehicle_positions;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS schedules;
DROP TABLE IF EXISTS route_stops;
DROP TABLE IF EXISTS stops;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS service_alerts;
DROP TABLE IF EXISTS press_resources;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
--  Users, vehicles, routes, stops
-- ============================================================

CREATE TABLE users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email           VARCHAR(190) NOT NULL UNIQUE,
  password_hash   VARCHAR(120) NOT NULL,
  full_name       VARCHAR(120) NOT NULL,
  phone           VARCHAR(30) NULL,
  role            ENUM('passenger','operator','admin') NOT NULL DEFAULT 'passenger',
  preferred_lang  ENUM('rw','en') NOT NULL DEFAULT 'rw',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vehicles (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  plate           VARCHAR(30) NOT NULL UNIQUE,
  label           VARCHAR(80) NOT NULL,
  capacity        SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  status          ENUM('active','idle','maintenance','offline') NOT NULL DEFAULT 'idle',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE routes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(20) NOT NULL UNIQUE,
  name_rw         VARCHAR(160) NOT NULL,
  name_en         VARCHAR(160) NOT NULL,
  direction_label VARCHAR(160) NOT NULL,
  color_hex       CHAR(7) NOT NULL DEFAULT '#0ea5e9',
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_routes_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE stops (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(30) NOT NULL UNIQUE,
  name_rw         VARCHAR(160) NOT NULL,
  name_en         VARCHAR(160) NOT NULL,
  lat             DECIMAL(10,7) NOT NULL,
  lng             DECIMAL(10,7) NOT NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_stops_lat_lng (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Route composition
-- ============================================================

CREATE TABLE route_stops (
  route_id               BIGINT UNSIGNED NOT NULL,
  stop_id                BIGINT UNSIGNED NOT NULL,
  sequence_no            SMALLINT UNSIGNED NOT NULL,
  distance_from_start_m  INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, stop_id),
  UNIQUE KEY uk_route_seq (route_id, sequence_no),
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (stop_id)  REFERENCES stops(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE schedules (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NOT NULL,
  departure_time  TIME NOT NULL,
  days_of_week    SET('mon','tue','wed','thu','fri','sat','sun') NOT NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  INDEX idx_schedules_route (route_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE trips (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NOT NULL,
  vehicle_id      BIGINT UNSIGNED NULL,
  started_at      DATETIME NOT NULL,
  ended_at        DATETIME NULL,
  direction       ENUM('outbound','inbound') NOT NULL DEFAULT 'outbound',
  status          ENUM('scheduled','running','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  FOREIGN KEY (route_id)   REFERENCES routes(id)   ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
  INDEX idx_trips_route (route_id),
  INDEX idx_trips_vehicle (vehicle_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Live tracking
-- ============================================================

CREATE TABLE vehicle_positions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      BIGINT UNSIGNED NOT NULL,
  route_id        BIGINT UNSIGNED NULL,
  trip_id         BIGINT UNSIGNED NULL,
  lat             DECIMAL(10,7) NOT NULL,
  lng             DECIMAL(10,7) NOT NULL,
  speed_kmh       DECIMAL(6,2) NULL,
  heading_deg     SMALLINT NULL,
  source          ENUM('simulator','gps','manual') NOT NULL,
  recorded_at     DATETIME NOT NULL,
  received_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_vp_vehicle_time (vehicle_id, recorded_at),
  INDEX idx_vp_route_time   (route_id,   recorded_at),
  INDEX idx_vp_source_time  (source,     recorded_at),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id)   REFERENCES routes(id)   ON DELETE SET NULL,
  FOREIGN KEY (trip_id)    REFERENCES trips(id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Fares, bookings, tickets
-- ============================================================

CREATE TABLE fares (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NOT NULL,
  from_stop_id    BIGINT UNSIGNED NOT NULL,
  to_stop_id      BIGINT UNSIGNED NOT NULL,
  amount_rwf      INT UNSIGNED NOT NULL,
  UNIQUE KEY uk_fare (route_id, from_stop_id, to_stop_id),
  FOREIGN KEY (route_id)     REFERENCES routes(id) ON DELETE CASCADE,
  FOREIGN KEY (from_stop_id) REFERENCES stops(id)  ON DELETE CASCADE,
  FOREIGN KEY (to_stop_id)   REFERENCES stops(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE bookings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference       CHAR(12) NOT NULL UNIQUE,
  user_id         BIGINT UNSIGNED NOT NULL,
  route_id        BIGINT UNSIGNED NOT NULL,
  from_stop_id    BIGINT UNSIGNED NOT NULL,
  to_stop_id      BIGINT UNSIGNED NOT NULL,
  depart_at       DATETIME NOT NULL,
  passenger_name  VARCHAR(120) NOT NULL,
  passenger_phone VARCHAR(30) NULL,
  amount_rwf      INT UNSIGNED NOT NULL,
  status          ENUM('pending','paid','cancelled','expired') NOT NULL DEFAULT 'pending',
  payment_ref     VARCHAR(64) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_bookings_user (user_id),
  INDEX idx_bookings_status (status),
  INDEX idx_bookings_route (route_id),
  FOREIGN KEY (user_id)      REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (route_id)     REFERENCES routes(id),
  FOREIGN KEY (from_stop_id) REFERENCES stops(id),
  FOREIGN KEY (to_stop_id)   REFERENCES stops(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id      BIGINT UNSIGNED NOT NULL UNIQUE,
  code            CHAR(24) NOT NULL UNIQUE,
  qr_payload      VARCHAR(255) NOT NULL,
  issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at      DATETIME NOT NULL,
  status          ENUM('issued','redeemed','expired','cancelled') NOT NULL DEFAULT 'issued',
  INDEX idx_tickets_status (status),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The UNIQUE on ticket_id is what makes redemption race-safe.
CREATE TABLE ticket_redemptions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       BIGINT UNSIGNED NOT NULL UNIQUE,
  redeemed_by     BIGINT UNSIGNED NOT NULL,
  redeemed_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id)   REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (redeemed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Alerts, press locker, AI log, audit
-- ===========================================================
CREATE TABLE service_alerts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NULL,
  severity        ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  title_rw        VARCHAR(180) NOT NULL,
  title_en        VARCHAR(180) NOT NULL,
  body_rw         TEXT NOT NULL,
  body_en         TEXT NOT NULL,
  starts_at       DATETIME NOT NULL,
  ends_at         DATETIME NULL,
  is_active       TINYINT(1) NOT NULL DEFAULT 1,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alerts_active (is_active, starts_at, ends_at),
  FOREIGN KEY (route_id)   REFERENCES routes(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE press_resources (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug            VARCHAR(120) NOT NULL UNIQUE,
  title           VARCHAR(200) NOT NULL,
  category        ENUM('logo','press_release','factsheet','image','video','document','mediakit') NOT NULL,
  description     TEXT NULL,
  file_path       VARCHAR(255) NULL,
  external_url    VARCHAR(500) NULL,
  file_size_bytes INT UNSIGNED NULL,
  mime_type       VARCHAR(120) NULL,
  is_published    TINYINT(1) NOT NULL DEFAULT 0,
  published_at    DATETIME NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_press_published (is_published, published_at),
  INDEX idx_press_category  (category),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE ai_conversations (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL,
  session_key     CHAR(36) NOT NULL,
  lang            ENUM('rw','en') NOT NULL DEFAULT 'rw',
  role            ENUM('user','assistant','tool','system') NOT NULL,
  content         MEDIUMTEXT NOT NULL,
  tool_name       VARCHAR(80) NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_session (session_key, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id        BIGINT UNSIGNED NULL,
  action          VARCHAR(80) NOT NULL,
  entity          VARCHAR(60) NOT NULL,
  entity_id       VARCHAR(60) NULL,
  meta_json       JSON NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_actor  (actor_id),
  INDEX idx_audit_entity (entity, entity_id),
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
--  Done
-- ============================================================

SELECT 'RouteView schema ready.' AS status,
       COUNT(*) AS tables_created
  FROM information_schema.tables
 WHERE table_schema = 'routeview';