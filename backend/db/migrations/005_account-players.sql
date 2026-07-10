-- Verknüpfung Account ↔ Spieler-Einträge ("das bin ich").
-- Additiv — bestehende anonyme players/game_players/scores bleiben unberührt.

CREATE TABLE IF NOT EXISTS public.account_players (
    account_id uuid NOT NULL,
    player_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (account_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_account_players_player ON public.account_players USING btree (player_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_account_players_account') THEN
    ALTER TABLE public.account_players ADD CONSTRAINT fk_account_players_account
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_account_players_player') THEN
    ALTER TABLE public.account_players ADD CONSTRAINT fk_account_players_player
      FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;
  END IF;
END $$;
