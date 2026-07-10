-- Spiel-Ownership: wer ein Spiel eingeloggt erstellt, wird als Ersteller vermerkt.
-- Nullable — anonym erstellte Spiele haben keinen Ersteller. ON DELETE SET NULL,
-- damit das Löschen eines Kontos die Spiele (und deren Scores) intakt lässt.
ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_games_created_by ON public.games USING btree (created_by);
