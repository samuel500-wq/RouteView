-- ============================================================
--  Interprovincial ticketing
--  Run after the main schema.
-- ============================================================

USE routeview;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS intercity_tickets;
DROP TABLE IF EXISTS intercity_bookings;
DROP TABLE IF EXISTS intercity_trips;
DROP TABLE IF EXISTS intercity_schedules;
DROP TABLE IF EXISTS intercity_routes;
DROP TABLE IF EXISTS intercity_companies;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE intercity_companies (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,
  name         VARCHAR(120) NOT NULL,
  phone        VARCHAR(30) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE intercity_routes (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  origin_city           VARCHAR(80) NOT NULL,
  origin_terminal       VARCHAR(120) NOT NULL,
  destination_city      VARCHAR(80) NOT NULL,
  destination_terminal  VARCHAR(120) NOT NULL,
  province              ENUM('northern','southern','eastern','western') NOT NULL,
  distance_km           SMALLINT UNSIGNED NOT NULL,
  duration_min          SMALLINT UNSIGNED NOT NULL,
  base_price_rwf        INT UNSIGNED NOT NULL,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_ic_route_origin (origin_city),
  INDEX idx_ic_route_dest (destination_city),
  INDEX idx_ic_route_province (province)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE intercity_schedules (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NOT NULL,
  company_id      BIGINT UNSIGNED NOT NULL,
  departure_time  TIME NOT NULL,
  days_of_week    SET('mon','tue','wed','thu','fri','sat','sun') NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
  bus_type        ENUM('standard','express','vip') NOT NULL DEFAULT 'standard',
  total_seats     SMALLINT UNSIGNED NOT NULL DEFAULT 45,
  FOREIGN KEY (route_id)   REFERENCES intercity_routes(id)   ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES intercity_companies(id) ON DELETE CASCADE,
  INDEX idx_sched_route (route_id),
  INDEX idx_sched_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE intercity_trips (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  schedule_id     BIGINT UNSIGNED NOT NULL,
  route_id        BIGINT UNSIGNED NOT NULL,
  company_id      BIGINT UNSIGNED NOT NULL,
  trip_date       DATE NOT NULL,
  departure_dt    DATETIME NOT NULL,
  price_rwf       INT UNSIGNED NOT NULL,
  seats_total     SMALLINT UNSIGNED NOT NULL,
  seats_booked    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  plate_number    VARCHAR(30) NULL,
  driver_name     VARCHAR(120) NULL,
  driver_phone    VARCHAR(30) NULL,
  status          ENUM('scheduled','boarding','departed','arrived','cancelled') NOT NULL DEFAULT 'scheduled',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_trip (schedule_id, trip_date),
  INDEX idx_trip_date (trip_date),
  INDEX idx_trip_route_date (route_id, trip_date),
  FOREIGN KEY (schedule_id) REFERENCES intercity_schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (route_id)    REFERENCES intercity_routes(id)    ON DELETE CASCADE,
  FOREIGN KEY (company_id)  REFERENCES intercity_companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE intercity_bookings (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference         CHAR(12) NOT NULL UNIQUE,
  user_id           BIGINT UNSIGNED NOT NULL,
  trip_id           BIGINT UNSIGNED NOT NULL,
  passenger_name    VARCHAR(120) NOT NULL,
  passenger_phone   VARCHAR(30) NULL,
  passenger_email   VARCHAR(190) NULL,
  passenger_id_no   VARCHAR(30) NULL,
  seat_number       SMALLINT UNSIGNED NULL,
  amount_rwf        INT UNSIGNED NOT NULL,
  status            ENUM('pending','paid','cancelled','refunded') NOT NULL DEFAULT 'pending',
  payment_ref       VARCHAR(64) NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (trip_id) REFERENCES intercity_trips(id) ON DELETE CASCADE,
  INDEX idx_ic_booking_user (user_id),
  INDEX idx_ic_booking_trip (trip_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE intercity_tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id      BIGINT UNSIGNED NOT NULL UNIQUE,
  code            CHAR(24) NOT NULL UNIQUE,
  qr_payload      VARCHAR(255) NOT NULL,
  issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  departure_dt    DATETIME NOT NULL,
  status          ENUM('issued','used','expired','cancelled') NOT NULL DEFAULT 'issued',
  used_at         DATETIME NULL,
  used_by         BIGINT UNSIGNED NULL,
  scanned_plate   VARCHAR(30) NULL,
  INDEX idx_ic_ticket_code (code),
  INDEX idx_ic_ticket_status (status),
  FOREIGN KEY (booking_id) REFERENCES intercity_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by)    REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;