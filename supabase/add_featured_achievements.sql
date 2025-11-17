-- Add featured_achievements column to user_profiles
-- This column stores an array of up to 3 achievement codes that the user wants to showcase on their profile

ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS featured_achievements text[] DEFAULT ARRAY[]::text[];

COMMENT ON COLUMN public.user_profiles.featured_achievements IS 'Array of up to 3 achievement codes to display as featured on profile';
