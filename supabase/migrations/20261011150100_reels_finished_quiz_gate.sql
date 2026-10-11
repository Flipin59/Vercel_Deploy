-- R5: the 5-reel quiz gate now resets only when a reel quiz is finished, read from Play's
-- attempts on the server (getLastFinishedAt). `quiz_opened` rows, which students could
-- insert themselves, are no longer used or allowed.
delete from reels_events where kind = 'quiz_opened';

alter table reels_events drop constraint reels_events_check;
alter table reels_events drop constraint reels_events_kind_check;
alter table reels_events alter column reel_id set not null;
alter table reels_events add constraint reels_events_kind_check
  check (kind in ('view', 'complete', 'skip', 'like', 'unlike', 'save', 'unsave', 'share'));
