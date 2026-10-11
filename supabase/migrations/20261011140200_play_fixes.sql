-- Play Wave 1 review fixes (QUESTIONS.md §8, RATING.md §4, QUIZ.md §3).

-- 1. Question review. Every AI-written question in the bank was checked for a correct,
-- unambiguous answer, no product/brand/fund advice, stated assumptions and fit for
-- 16–18 year olds. Two needed a wording fix (also made in data/questions/budget.json).
update play_questions
   set content = jsonb_set(content, '{en,prompt}', to_jsonb('Anjali gets ₹2,400 for a 30-day month. On day 1 she pays ₹600 for a bus pass and ₹300 for a recharge, and saves ₹300. Spread over all 30 days, how much can she spend per day?'::text))
 where id = 'budget-pocket-money-006';
update play_questions
   set content = jsonb_set(content, '{en,options,1}', to_jsonb('EMI costs ₹499 more, but you keep cash in hand longer'::text))
 where id = 'budget-bills-and-emi-009';

-- Reviewed and passed: published. Listed by id so later drafts stay draft.
update play_questions set status = 'live' where status = 'draft' and id in (
  'budget-needs-vs-wants-001', 'budget-50-30-20-001', 'budget-tracking-spending-001', 'budget-needs-vs-wants-002',
  'budget-needs-vs-wants-003', 'budget-needs-vs-wants-004', 'budget-needs-vs-wants-005', 'budget-needs-vs-wants-006',
  'budget-tracking-spending-002', 'budget-tracking-spending-003', 'budget-50-30-20-002', 'budget-pocket-money-001',
  'budget-bills-and-emi-001', 'budget-bills-and-emi-002', 'budget-pocket-money-002', 'budget-bills-and-emi-003',
  'budget-bills-and-emi-004', 'budget-pocket-money-003', 'budget-50-30-20-003', 'budget-tracking-spending-004',
  'budget-pocket-money-004', 'budget-50-30-20-004', 'budget-needs-vs-wants-007', 'budget-bills-and-emi-005',
  'budget-tracking-spending-005', 'budget-needs-vs-wants-008', 'budget-pocket-money-005', 'budget-bills-and-emi-006',
  'budget-50-30-20-005', 'budget-tracking-spending-006', 'budget-tracking-spending-007', 'budget-bills-and-emi-007',
  'budget-50-30-20-006', 'budget-pocket-money-006', 'budget-bills-and-emi-008', 'budget-bills-and-emi-009',
  'budget-needs-vs-wants-009', 'budget-bills-and-emi-010', 'budget-50-30-20-007', 'budget-bills-and-emi-011',
  'budget-pocket-money-007', 'budget-pocket-money-008', 'budget-50-30-20-008', 'budget-bills-and-emi-012',
  'budget-tracking-spending-008', 'save-emergency-fund-001', 'save-emergency-fund-002', 'save-emergency-fund-003',
  'save-emergency-fund-004', 'save-savings-goals-001', 'save-emergency-fund-005', 'save-bank-accounts-001',
  'save-bank-accounts-002', 'save-bank-accounts-003', 'save-simple-interest-001', 'save-simple-interest-002',
  'save-compound-interest-001', 'save-inflation-001', 'save-inflation-002', 'save-savings-goals-002',
  'save-compound-interest-002', 'save-emergency-fund-006', 'save-emergency-fund-007', 'save-emergency-fund-008',
  'save-savings-goals-003', 'save-savings-goals-004', 'save-bank-accounts-004', 'save-bank-accounts-005',
  'save-bank-accounts-006', 'save-simple-interest-003', 'save-simple-interest-004', 'save-compound-interest-003',
  'save-compound-interest-004', 'save-inflation-003', 'save-inflation-004', 'save-simple-interest-005',
  'save-compound-interest-005', 'save-compound-interest-006', 'save-inflation-005', 'save-compound-interest-007',
  'save-emergency-fund-009', 'save-bank-accounts-007', 'save-inflation-006', 'save-compound-interest-008',
  'save-savings-goals-005', 'save-savings-goals-006', 'save-emergency-fund-010', 'save-inflation-007',
  'save-compound-interest-009', 'save-bank-accounts-008', 'invest-risk-and-return-001', 'invest-risk-and-return-002',
  'invest-diversification-001', 'invest-diversification-002', 'invest-time-horizon-001', 'invest-time-horizon-002',
  'invest-mutual-fund-basics-001', 'invest-mutual-fund-basics-002', 'invest-stocks-basics-001', 'invest-stocks-basics-002',
  'invest-gold-and-fd-001', 'invest-gold-and-fd-002', 'invest-gold-and-fd-003', 'invest-mutual-fund-basics-003',
  'invest-risk-and-return-003', 'invest-time-horizon-003', 'invest-diversification-003', 'invest-risk-and-return-004',
  'invest-stocks-basics-003', 'invest-mutual-fund-basics-004', 'invest-time-horizon-004', 'invest-diversification-004',
  'invest-gold-and-fd-004', 'invest-mutual-fund-basics-005', 'invest-risk-and-return-005', 'invest-stocks-basics-004',
  'invest-gold-and-fd-005', 'invest-diversification-005', 'invest-time-horizon-005', 'invest-stocks-basics-005',
  'invest-diversification-006', 'invest-risk-and-return-006', 'invest-diversification-007', 'invest-gold-and-fd-006',
  'invest-mutual-fund-basics-006', 'invest-risk-and-return-007', 'invest-time-horizon-006', 'invest-time-horizon-007',
  'invest-risk-and-return-008', 'invest-time-horizon-008', 'invest-diversification-008', 'invest-diversification-009',
  'invest-diversification-010', 'invest-diversification-011', 'invest-diversification-012', 'invest-time-horizon-009',
  'invest-mutual-fund-basics-007', 'invest-diversification-013', 'invest-risk-and-return-009', 'invest-stocks-basics-006',
  'safety-otp-and-pin-001', 'safety-phishing-001', 'safety-upi-fraud-001', 'safety-otp-and-pin-002',
  'safety-upi-fraud-002', 'safety-otp-and-pin-003', 'safety-otp-and-pin-004', 'safety-insurance-basics-001',
  'safety-insurance-basics-002', 'safety-phishing-002', 'safety-phishing-003', 'safety-fake-loan-apps-001',
  'safety-ponzi-and-chit-scams-001', 'safety-ponzi-and-chit-scams-002', 'safety-upi-fraud-003', 'safety-upi-fraud-004',
  'safety-phishing-004', 'safety-fake-loan-apps-002', 'safety-ponzi-and-chit-scams-003', 'safety-ponzi-and-chit-scams-004',
  'safety-ponzi-and-chit-scams-005', 'safety-upi-fraud-005', 'safety-otp-and-pin-005', 'safety-upi-fraud-006',
  'safety-phishing-005', 'safety-insurance-basics-003', 'safety-insurance-basics-004', 'safety-fake-loan-apps-003',
  'safety-otp-and-pin-006', 'safety-upi-fraud-007', 'safety-ponzi-and-chit-scams-006', 'safety-fake-loan-apps-004',
  'safety-fake-loan-apps-005', 'safety-ponzi-and-chit-scams-007', 'safety-insurance-basics-005', 'safety-ponzi-and-chit-scams-008',
  'safety-insurance-basics-006', 'safety-fake-loan-apps-006', 'safety-upi-fraud-008', 'safety-phishing-006',
  'safety-upi-fraud-009', 'safety-otp-and-pin-007', 'safety-fake-loan-apps-007', 'safety-ponzi-and-chit-scams-009',
  'safety-insurance-basics-007'
);

-- 2. "Show answer" after a wrong first try is stored as a try-2 row with revealed = true
-- (no coins, no XP). It takes the reattempt's slot, so the reattempt is forfeited.
alter table play_answers add column revealed boolean not null default false;

-- 3. The placement quiz can be taken once (RATING.md §4). Earlier duplicate placement
-- attempts are removed first, keeping each student's first; their XP was already capped
-- by the placement:<questionId> refs.
delete from play_attempts a
 using play_attempts b
 where a.context = 'placement' and b.context = 'placement' and a.user_id = b.user_id
   and (a.created_at, a.id) > (b.created_at, b.id);
create unique index play_attempts_one_placement on play_attempts (user_id) where context = 'placement';

-- 4. Link reviewed questions to the five new Learn chapters (5 each, QUESTIONS.md §6).
update play_questions set chapter_slug = 'budget-no-cost-emi' where id in ('budget-bills-and-emi-001', 'budget-bills-and-emi-005', 'budget-bills-and-emi-007', 'budget-bills-and-emi-009', 'budget-bills-and-emi-012');
update play_questions set chapter_slug = 'save-credit-card-trap' where id in ('budget-bills-and-emi-008', 'budget-bills-and-emi-011', 'save-compound-interest-001', 'save-compound-interest-003', 'save-compound-interest-004');
update play_questions set chapter_slug = 'invest-inflation' where id in ('save-inflation-001', 'save-inflation-002', 'save-inflation-004', 'save-inflation-006', 'save-inflation-007');
update play_questions set chapter_slug = 'save-chai-math' where id in ('budget-tracking-spending-003', 'budget-tracking-spending-005', 'budget-tracking-spending-006', 'budget-tracking-spending-007', 'budget-tracking-spending-008');
update play_questions set chapter_slug = 'safety-money-mule' where id in ('safety-phishing-005', 'safety-upi-fraud-003', 'safety-upi-fraud-007', 'safety-upi-fraud-009', 'safety-phishing-006');
