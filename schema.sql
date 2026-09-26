CREATE TABLE IF NOT EXISTS posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titlu VARCHAR(255) NOT NULL,
  youtube_id VARCHAR(64) NOT NULL,
  imagine_url VARCHAR(500) DEFAULT NULL,
  data TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_posts_youtube_id (youtube_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id INT UNSIGNED NOT NULL,
  nume_utilizator VARCHAR(120) NOT NULL,
  text_comentariu TEXT NOT NULL,
  data TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_comments_post_id (post_id),
  CONSTRAINT fk_comments_post
    FOREIGN KEY (post_id)
    REFERENCES posts(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS gallery (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  titlu VARCHAR(180) NOT NULL,
  imagine_url VARCHAR(500) NOT NULL,
  data_upload TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_gallery_data_upload (data_upload)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rezervari (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nume VARCHAR(90) NOT NULL,
  telefon VARCHAR(20) NOT NULL,
  eveniment VARCHAR(50) NOT NULL,
  data_eveniment DATE NOT NULL,
  mesaj TEXT DEFAULT NULL,
  gdpr_consent TINYINT(1) NOT NULL DEFAULT 1,
  creat_la TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_rezervari_creat_la (creat_la)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS track_plays (
  track_id VARCHAR(191) NOT NULL,
  play_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (track_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS budget_intents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  budget_eur SMALLINT UNSIGNED NOT NULL,
  page_path VARCHAR(128) NOT NULL,
  selected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_budget_intents_selected_at (selected_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS couple_submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  couple_slug VARCHAR(120) NOT NULL,
  tip ENUM('story','recommendation','video') NOT NULL,
  continut TEXT NOT NULL,
  sursa VARCHAR(255) DEFAULT NULL,
  stare ENUM('in_asteptare','aprobat','respins') NOT NULL DEFAULT 'in_asteptare',
  creat_la TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_couple_submissions_slug (couple_slug)
) ENGINE=InnoDB;

