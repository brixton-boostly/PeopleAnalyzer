-- Add retro_participant_ids to track which employees were selected for a given retro launch
ALTER TABLE review_cycles
  ADD COLUMN IF NOT EXISTS retro_participant_ids JSONB;
