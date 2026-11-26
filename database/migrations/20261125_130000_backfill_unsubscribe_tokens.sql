-- Migration: give every subscriber an unsubscribe token (CAN-SPAM / GDPR)
-- Date: 2026-11-25 13:00:00

UPDATE `newsletter_subscribers`
  SET `unsubscribe_token` = SHA2(CONCAT(`id`, ':', `email`, ':', RAND(), ':', NOW(6)), 256)
  WHERE `unsubscribe_token` IS NULL;
