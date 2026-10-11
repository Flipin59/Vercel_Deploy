-- The 12 reel-linked questions quoted the placeholder reel scripts, which were replaced by
-- the real clips in the `reels` Storage bucket (20261011220000_reels_bucket_clips). They
-- can't be answered from the new clips, so they stop being served. Reel quizzes top up from
-- each reel's tags until the Reels owner writes one question per new reel (QUESTIONS.md §6).
update play_questions set status = 'retired' where id in ('budget-needs-vs-wants-001', 'save-inflation-005', 'budget-50-30-20-001', 'budget-tracking-spending-001', 'budget-bills-and-emi-003', 'budget-bills-and-emi-004', 'save-emergency-fund-001', 'save-compound-interest-002', 'invest-diversification-006', 'safety-otp-and-pin-001', 'safety-phishing-001', 'safety-upi-fraud-004');
