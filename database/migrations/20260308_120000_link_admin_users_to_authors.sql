-- Migration: Link admin/author users to authors table
-- Any user with role 'admin' or 'author' who has no author_id gets an authors record created
-- and their author_id updated to point to it.

INSERT INTO `authors` (`name`, `slug`, `bio`, `email`, `created_at`, `updated_at`)
SELECT
  COALESCE(u.name, SUBSTRING_INDEX(u.email, '@', 1)) AS `name`,
  LOWER(REPLACE(COALESCE(u.name, SUBSTRING_INDEX(u.email, '@', 1)), ' ', '-')) AS `slug`,
  '' AS `bio`,
  u.email,
  NOW(),
  NOW()
FROM `users` u
WHERE u.role IN ('admin', 'author')
  AND u.author_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `authors` a WHERE a.email = u.email
  );

-- Link users to their newly created (or pre-existing by email) author record
UPDATE `users` u
JOIN `authors` a ON a.email = u.email
SET u.author_id = a.id
WHERE u.role IN ('admin', 'author')
  AND u.author_id IS NULL;
