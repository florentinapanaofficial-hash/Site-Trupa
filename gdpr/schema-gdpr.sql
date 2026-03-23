-- ═══════════════════════════════════════════════════════════════════════
-- SCHEMA GDPR – MySQL / MariaDB 10.5+
-- Fișier: gdpr/schema-gdpr.sql
--
-- Scopul tabelului: Stocarea probei de consimțământ GDPR (Art. 7 RGPD)
-- Operatorul trebuie să poată dovedi că utilizatorul și-a dat/retras
-- consimțământul, inclusiv momentul și versiunea politicii acceptate.
--
-- Rulare:
--   mysql -u <user> -p <database> < gdpr/schema-gdpr.sql
-- ═══════════════════════════════════════════════════════════════════════

-- Asigurăm că lucrăm cu charset corect pentru caracterele românești
SET NAMES utf8mb4;
SET time_zone = '+00:00';


-- ───────────────────────────────────────────────────────────────────────
-- 1. TABEL PRINCIPAL: gdpr_consimtamant
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_consimtamant (

  -- ── Cheie primară ──────────────────────────────────────────────────
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT
    COMMENT 'Identificator unic auto-incrementat',

  -- ── Tipul acțiunii pentru care s-a dat consimțământul ──────────────
  tip_consimtamant    VARCHAR(64)      NOT NULL
    COMMENT 'Ex: whatsapp_redirect | phone_call | email_contact',

  -- ── Canalul de comunicare ──────────────────────────────────────────
  canal               VARCHAR(32)      NOT NULL
    COMMENT 'Ex: whatsapp | telefon | email',

  -- ── Adresa IP hașată (SHA-256) – principiu minimizare date Art. 5 ──
  -- IP-ul brut NU se stochează; hașarea se face la nivel SQL (SHA2)
  -- cu un salt opțional pentru a preveni reverse-lookup prin rainbow tables
  ip_hash             CHAR(64)         NOT NULL
    COMMENT 'SHA-256 al adresei IP – nu se stochează IP-ul în clar',

  -- ── User-Agent browser ─────────────────────────────────────────────
  user_agent          VARCHAR(512)     NULL
    COMMENT 'Browser/OS client – util pentru audit și detectare bot',

  -- ── Referer – URL paginii de origine la momentul consimțământului ──
  referer             VARCHAR(255)     NULL
    COMMENT 'Pagina site-ului de unde s-a dat consimțământul',

  -- ── Timestamp UTC – esențial pentru proba GDPR ─────────────────────
  data_consimtamant   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP
    COMMENT 'Momentul exact (UTC) al consimțământului',

  -- ── Versiunea politicii de confidențialitate acceptate ─────────────
  versiune_politica   VARCHAR(16)      NOT NULL DEFAULT '1.0'
    COMMENT 'Versiunea documentului de politică acceptat de utilizator',

  -- ── Soft delete – marcator de ștergere logică ──────────────────────
  -- NULL = consimțământ activ; valoare = data ștergerii
  -- Permite auditare POST-ștergere fără a elimina fizic înregistrarea
  sters_la            DATETIME         NULL     DEFAULT NULL
    COMMENT 'NULL = activ; data completată = marcat șters (soft delete)',

  -- ── Cheie primară și indecși ───────────────────────────────────────
  PRIMARY KEY (id),

  -- Index pe timestamp → interogări rapide pentru curățare periodică
  INDEX idx_data          (data_consimtamant),

  -- Index pe hash IP → căutare pentru cererile de ștergere Art. 17
  INDEX idx_ip_hash       (ip_hash),

  -- Index compus tip + canal → rapoarte statistice
  INDEX idx_tip_canal     (tip_consimtamant, canal),

  -- Index soft delete → filtrare rapidă înregistrări active vs. șterse
  INDEX idx_sters_la      (sters_la)

) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tabel GDPR – proba de consimțământ Art. 7 RGPD';


-- ───────────────────────────────────────────────────────────────────────
-- 2. PROCEDURĂ STOCARE: Ștergere automată (soft delete) după 12 luni
--
-- Rulare manuală: CALL sterge_consimtaminte_expirate();
-- Rulare automată: vezi Event MySQL (secțiunea 3)
-- ───────────────────────────────────────────────────────────────────────

DROP PROCEDURE IF EXISTS sterge_consimtaminte_expirate;
DELIMITER $$

CREATE PROCEDURE sterge_consimtaminte_expirate()
BEGIN
  DECLARE v_marcate INT DEFAULT 0;
  DECLARE v_sterse  INT DEFAULT 0;

  -- Pasul 1: Soft delete – marchează înregistrările > 12 luni
  UPDATE gdpr_consimtamant
     SET sters_la = NOW()
   WHERE data_consimtamant < DATE_SUB(NOW(), INTERVAL 12 MONTH)
     AND sters_la IS NULL;

  SET v_marcate = ROW_COUNT();

  -- Pasul 2 (opțional): DELETE fizic al înregistrărilor marcate > 30 zile
  -- Decomentați dacă doriți eliminare fizică după grace period:
  -- DELETE FROM gdpr_consimtamant
  --  WHERE sters_la IS NOT NULL
  --    AND sters_la < DATE_SUB(NOW(), INTERVAL 30 DAY);
  -- SET v_sterse = ROW_COUNT();

  -- Raport execuție
  SELECT
    v_marcate AS randuri_marcate_sterse,
    v_sterse  AS randuri_sterse_fizic,
    NOW()     AS executat_la;
END$$

DELIMITER ;


-- ───────────────────────────────────────────────────────────────────────
-- 3. EVENT MYSQL: Execuție lunară automată a procedurii de ștergere
--
-- Precondiție: event scheduler activat:
--   SET GLOBAL event_scheduler = ON;  ← rulați o singură dată ca admin
--   (sau adăugați event_scheduler=ON în my.cnf sub [mysqld])
-- ───────────────────────────────────────────────────────────────────────

DROP EVENT IF EXISTS evt_sterge_gdpr_expirat;

CREATE EVENT evt_sterge_gdpr_expirat
  ON SCHEDULE EVERY 1 MONTH
    STARTS (DATE_FORMAT(NOW() + INTERVAL 1 MONTH, '%Y-%m-01 03:00:00'))
  ON COMPLETION PRESERVE
  ENABLE
  COMMENT 'Ștergere automată lunară consimțăminte GDPR expirate (>12 luni)'
  DO CALL sterge_consimtaminte_expirate();


-- ───────────────────────────────────────────────────────────────────────
-- 4. VIEW UTIL: Consimțăminte active (neșterse) din ultimul an
--    Util pentru rapoarte de audit fără a accesa înregistrările șterse.
-- ───────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_consimtaminte_active AS
  SELECT
    id,
    tip_consimtamant,
    canal,
    ip_hash,
    LEFT(user_agent, 80) AS ua_scurt,   -- trunchiuem pentru afișare
    referer,
    data_consimtamant,
    versiune_politica
  FROM gdpr_consimtamant
  WHERE sters_la IS NULL
    AND data_consimtamant >= DATE_SUB(NOW(), INTERVAL 12 MONTH);


-- ───────────────────────────────────────────────────────────────────────
-- 5. INTEROGĂRI DE VERIFICARE (rulați după migrare)
-- ───────────────────────────────────────────────────────────────────────

-- Verificare structură tabel:
-- DESCRIBE gdpr_consimtamant;

-- Verificare indecși:
-- SHOW INDEX FROM gdpr_consimtamant;

-- Test inserare:
-- INSERT INTO gdpr_consimtamant
--   (tip_consimtamant, canal, ip_hash, user_agent, referer, versiune_politica)
-- VALUES
--   ('whatsapp_redirect', 'whatsapp', SHA2('127.0.0.1', 256),
--    'Mozilla/5.0 Test Browser', 'http://localhost:4321/contact', '1.0');

-- Verificare inserare:
-- SELECT * FROM v_consimtaminte_active LIMIT 5;
