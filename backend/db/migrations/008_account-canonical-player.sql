-- Kanonische Selbst-Identität: eine stabile Spieler-Zeile pro Konto.
-- Ersetzt das namensbasierte Claiming — die Zuordnung läuft ab jetzt
-- ausschließlich explizit über diese eine ID (kollisionsfrei).
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS player_id text REFERENCES public.players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_player ON public.accounts USING btree (player_id);
