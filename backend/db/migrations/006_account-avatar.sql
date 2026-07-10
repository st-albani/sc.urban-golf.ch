-- Avatar (kleiner base64-data:-URL) am Account, optional.
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS avatar text;
