-- Add last_activity_date to track daily login streaks
-- This column stores the last date (YYYY-MM-DD) the user played any game

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS last_activity_date date;

COMMENT ON COLUMN public.user_profiles.last_activity_date IS 'Last date user played a game (for daily streak tracking)';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_activity 
ON public.user_profiles(last_activity_date);
