ALTER TABLE requests ADD COLUMN decline_reason TEXT;
ALTER TABLE requests ADD COLUMN spec_agent_id TEXT;
ALTER TABLE requests ADD COLUMN spec_run_id TEXT;
ALTER TABLE requests ADD COLUMN spec_text TEXT;
ALTER TABLE requests ADD COLUMN issue_url TEXT;
ALTER TABLE requests ADD COLUMN issue_number INTEGER;
ALTER TABLE requests ADD COLUMN error TEXT;
