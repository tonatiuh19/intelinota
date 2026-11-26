-- Migration: Add social_links JSON column to authors table
-- Date: 2026-03-09 12:00:00
-- Description: Adds a social_links JSON column to store social network URLs
--              (facebook, instagram, linkedin, youtube, tiktok, website)

ALTER TABLE `authors`
  ADD COLUMN `social_links` JSON DEFAULT NULL
  COMMENT 'Social network URLs: {facebook, instagram, linkedin, youtube, tiktok, website}';
