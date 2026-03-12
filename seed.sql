-- Seed pentru tabela posts pe baza videoclipurilor existente in site.
-- ID-urile sunt fixe (1..5) pentru a pastra corespondenta corecta cu comments.post_id.

START TRANSACTION;

INSERT INTO posts (id, titlu, youtube_id, imagine_url, data)
VALUES
  (1, 'Muzica populara - moment live', 'aDB9Aa9cFLY', 'https://img.youtube.com/vi/aDB9Aa9cFLY/hqdefault.jpg', NOW()),
  (2, 'Muzica populara - energie de petrecere', 'LSd5N1AmiFg', 'https://img.youtube.com/vi/LSd5N1AmiFg/hqdefault.jpg', NOW()),
  (3, 'Muzica populara - recital live', 'OSrEJczdKuw', 'https://img.youtube.com/vi/OSrEJczdKuw/hqdefault.jpg', NOW()),
  (4, 'Muzica usoara - moment live', 'xdcdjAtxZlA', 'https://img.youtube.com/vi/xdcdjAtxZlA/hqdefault.jpg', NOW()),
  (5, 'Muzica usoara - atmosfera live', 'FyrQQqFMZvg', 'https://img.youtube.com/vi/FyrQQqFMZvg/hqdefault.jpg', NOW())
ON DUPLICATE KEY UPDATE
  titlu = VALUES(titlu),
  youtube_id = VALUES(youtube_id),
  imagine_url = VALUES(imagine_url);

ALTER TABLE posts AUTO_INCREMENT = 6;

COMMIT;
