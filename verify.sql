-- Verificare integritate intre comments.post_id si posts.id

-- 1) Comentarii orfane: post_id care NU exista in posts
SELECT
  c.post_id,
  COUNT(*) AS comentarii_orfane
FROM comments c
LEFT JOIN posts p ON p.id = c.post_id
WHERE p.id IS NULL
GROUP BY c.post_id
ORDER BY comentarii_orfane DESC;

-- 2) Numar de comentarii pentru fiecare postare (inclusiv postarile cu 0 comentarii)
SELECT
  p.id,
  p.titlu,
  p.youtube_id,
  COUNT(c.id) AS total_comentarii
FROM posts p
LEFT JOIN comments c ON c.post_id = p.id
GROUP BY p.id, p.titlu, p.youtube_id
ORDER BY p.id ASC;

-- 3) Rezumat rapid: cate comentarii valide vs orfane exista in total
SELECT
  SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) AS comentarii_valide,
  SUM(CASE WHEN p.id IS NULL THEN 1 ELSE 0 END) AS comentarii_orfane
FROM comments c
LEFT JOIN posts p ON p.id = c.post_id;
