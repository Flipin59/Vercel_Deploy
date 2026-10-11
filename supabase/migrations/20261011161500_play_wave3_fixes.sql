-- Play fixes from the Wave 3a review. Owned by Sanjith Ganapathi.

-- W3-P6: the placement question on the student's screen (set by showQuestion). Resuming
-- placement counts it as a timeout if it was left unanswered.
alter table play_attempts add column shown_question text;

-- W3-P12: one report per duel per reporter (blockOpponent upserts on this).
delete from play_reports r using play_reports o
 where r.reporter = o.reporter and r.duel_id = o.duel_id and r.id > o.id;
create unique index play_reports_once on play_reports (reporter, duel_id);
