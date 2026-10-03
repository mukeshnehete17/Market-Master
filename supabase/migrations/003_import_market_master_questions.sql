--
-- Migration: 003_import_market_master_questions.sql
-- Source: Entrepreneurship_GK_40_MCQ_Questions.docx
-- Exact 40 questions (20 Entrepreneurship, 20 General Knowledge), duration = 15s
--

-- 1. Remove obsolete test games and demo questions
DELETE FROM games WHERE game_pin = 'XQPM7D' OR name LIKE '%verify%' OR name LIKE '%test%' OR name = 'reghsdfs';
DELETE FROM questions WHERE question_text LIKE '[H5B8377]%' OR question_text LIKE '[H31EDD1]%' OR category = 'Capital Markets' OR category = 'Test';

-- 2. Upsert the authoritative 40 questions
INSERT INTO questions (id, question_text, option_a, option_b, option_c, option_d, correct_option, category, duration_seconds, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Who is known as the father of modern entrepreneurship?', 'Joseph Schumpeter', 'Peter Drucker', 'Adam Smith', 'Philip Kotler', 'Joseph Schumpeter', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000002', 'Which of the following best defines an entrepreneur?', 'A person who only manages employees', 'A person who identifies opportunities and takes risks to create value', 'A person who works only for the government', 'A person who avoids all financial risks', 'A person who identifies opportunities and takes risks to create value', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000003', 'What is a startup?', 'An established government department', 'A newly created business designed to develop a scalable product or service', 'A type of bank account', 'A non-commercial hobby', 'A newly created business designed to develop a scalable product or service', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000004', 'What does MVP stand for in entrepreneurship?', 'Most Valuable Product', 'Minimum Viable Product', 'Maximum Value Proposition', 'Minimum Verified Process', 'Minimum Viable Product', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000005', 'Which document describes a company''s goals, strategy, market and financial projections?', 'Business plan', 'Invoice', 'Balance sheet', 'Purchase order', 'Business plan', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000006', 'What is bootstrapping?', 'Raising money only from banks', 'Starting and growing a business using personal funds and internally generated revenue', 'Selling a company to competitors', 'Hiring a large management team', 'Starting and growing a business using personal funds and internally generated revenue', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000007', 'What is market research used for?', 'Understanding customers, competitors and market conditions', 'Increasing office rent', 'Avoiding customer feedback', 'Replacing all employees', 'Understanding customers, competitors and market conditions', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000008', 'Which of these is an example of intellectual property?', 'Patent', 'Office chair', 'Electricity bill', 'Rent agreement', 'Patent', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000009', 'What is a business model?', 'A company''s logo', 'A framework explaining how a business creates, delivers and captures value', 'A list of employee names', 'A building design', 'A framework explaining how a business creates, delivers and captures value', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000010', 'What does ROI stand for?', 'Rate of Investment', 'Return on Investment', 'Revenue of Income', 'Risk of Innovation', 'Return on Investment', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000011', 'An angel investor typically invests in:', 'Early-stage businesses', 'Only government projects', 'Only large multinational corporations', 'Personal bank accounts', 'Early-stage businesses', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000012', 'What is a USP?', 'Unique Selling Proposition', 'Universal Sales Process', 'United Startup Plan', 'User Service Platform', 'Unique Selling Proposition', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000013', 'Which one is a common source of startup funding?', 'Venture capital', 'Library membership', 'Traffic fines', 'School timetable', 'Venture capital', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000014', 'What is customer validation?', 'Testing whether customers actually need and value a proposed solution', 'Checking employee attendance', 'Calculating office electricity usage', 'Registering a trademark only', 'Testing whether customers actually need and value a proposed solution', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000015', 'What does B2B mean?', 'Business to Business', 'Business to Buyer', 'Buyer to Business', 'Business to Bank', 'Business to Business', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000016', 'What does B2C mean?', 'Business to Customer', 'Bank to Customer', 'Business to Company', 'Buyer to Company', 'Business to Customer', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000017', 'Which quality is commonly associated with successful entrepreneurs?', 'Adaptability', 'Avoiding all decisions', 'Resistance to learning', 'Ignoring customers', 'Adaptability', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000018', 'What is a pivot in a startup?', 'Changing the business strategy or direction based on learning', 'Closing the company permanently', 'Hiring only managers', 'Increasing office size', 'Changing the business strategy or direction based on learning', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000019', 'What is a social entrepreneur primarily focused on?', 'Creating social or environmental value while pursuing a sustainable model', 'Avoiding all social issues', 'Only maximizing personal income', 'Selling government property', 'Creating social or environmental value while pursuing a sustainable model', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000020', 'Which metric measures the cost of acquiring one new customer?', 'CAC', 'GDP', 'CPI', 'ROI', 'CAC', 'Entrepreneurship', 15, true),
  ('c0000000-0000-0000-0000-000000000021', 'What is the capital of India?', 'Mumbai', 'New Delhi', 'Kolkata', 'Chennai', 'New Delhi', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000022', 'Who is known as the Father of the Indian Constitution?', 'Mahatma Gandhi', 'Dr. B. R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Patel', 'Dr. B. R. Ambedkar', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000023', 'Which is the largest planet in our Solar System?', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Jupiter', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000024', 'What is the national animal of India?', 'Lion', 'Elephant', 'Royal Bengal Tiger', 'Peacock', 'Royal Bengal Tiger', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000025', 'Which is the longest river in India?', 'Ganga', 'Yamuna', 'Godavari', 'Narmada', 'Ganga', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000026', 'Who was the first person to walk on the Moon?', 'Yuri Gagarin', 'Neil Armstrong', 'Buzz Aldrin', 'Michael Collins', 'Neil Armstrong', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000027', 'Which country is known as the Land of the Rising Sun?', 'China', 'South Korea', 'Japan', 'Thailand', 'Japan', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000028', 'What is the chemical symbol for gold?', 'Ag', 'Au', 'Fe', 'Cu', 'Au', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000029', 'Which is the smallest continent by land area?', 'Europe', 'Australia', 'South America', 'Antarctica', 'Australia', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000030', 'Who wrote the Indian national anthem ''Jana Gana Mana''?', 'Rabindranath Tagore', 'Bankim Chandra Chattopadhyay', 'Sarojini Naidu', 'Subhas Chandra Bose', 'Rabindranath Tagore', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000031', 'Which is the largest ocean on Earth?', 'Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean', 'Pacific Ocean', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000032', 'How many players are there in a cricket team on the field?', '9', '10', '11', '12', '11', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000033', 'Which planet is known as the Red Planet?', 'Venus', 'Mars', 'Mercury', 'Jupiter', 'Mars', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000034', 'What is the currency of Japan?', 'Won', 'Yuan', 'Yen', 'Ringgit', 'Yen', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000035', 'Which Indian city is known as the Silicon Valley of India?', 'Pune', 'Hyderabad', 'Bengaluru', 'Ahmedabad', 'Bengaluru', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000036', 'Which gas is most abundant in Earth''s atmosphere?', 'Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen', 'Nitrogen', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000037', 'Who discovered penicillin?', 'Alexander Fleming', 'Louis Pasteur', 'Isaac Newton', 'Marie Curie', 'Alexander Fleming', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000038', 'Which is the highest mountain in the world?', 'K2', 'Mount Everest', 'Kangchenjunga', 'Lhotse', 'Mount Everest', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000039', 'How many continents are there on Earth?', '5', '6', '7', '8', '7', 'General Knowledge', 15, true),
  ('c0000000-0000-0000-0000-000000000040', 'Which Indian state has the largest area?', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'General Knowledge', 15, true)
ON CONFLICT (id) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  option_a = EXCLUDED.option_a,
  option_b = EXCLUDED.option_b,
  option_c = EXCLUDED.option_c,
  option_d = EXCLUDED.option_d,
  correct_option = EXCLUDED.correct_option,
  category = EXCLUDED.category,
  duration_seconds = 15,
  is_active = true,
  updated_at = now();
