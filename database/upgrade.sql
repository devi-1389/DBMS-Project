-- ============================================================================
-- SOLACE | Non-destructive data upgrade for databases created by earlier versions
-- Executed by: python -m database.init_db --upgrade   (after schema.sql)
-- Safe to run multiple times.
-- ============================================================================

-- Experience artwork moved from the missing /static/images/*.webp files to
-- bundled illustrations in /static/images/experiences/*.svg
UPDATE experiences
SET image_url = CONCAT('/static/images/experiences/',
                       SUBSTRING_INDEX(SUBSTRING_INDEX(image_url, '/', -1), '.', 1), '.svg')
WHERE image_url LIKE '/static/images/%.webp';

-- Keep the derived itinerary totals consistent with their items
UPDATE itineraries i
SET i.estimated_cost = (SELECT COALESCE(SUM(ii.estimated_cost), 0)
                        FROM itinerary_items ii WHERE ii.itinerary_id = i.itinerary_id);
