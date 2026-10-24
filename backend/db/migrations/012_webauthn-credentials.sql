-- Passkey/WebAuthn als zweiter Login-Weg neben dem E-Mail-OTP.
--
-- webauthn_credentials: ein Passkey pro Zeile, an genau ein Konto gebunden.
-- sign_count wird bei jeder Anmeldung fortgeschrieben (Klon-Erkennung).
--
-- webauthn_challenges: kurzlebige, einmal verwendbare Challenges für
-- Registrierung (account_id gesetzt) und Anmeldung (account_id NULL).
--
-- Rein erweiternd. Idempotent (IF NOT EXISTS + DO-Block für FKs).

CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    credential_id text NOT NULL UNIQUE,
    public_key bytea NOT NULL,
    sign_count bigint NOT NULL DEFAULT 0,
    transports text[],
    created_at timestamptz DEFAULT now(),
    last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_account ON public.webauthn_credentials USING btree (account_id);

CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid,
    type text NOT NULL CHECK (type IN ('registration', 'authentication')),
    challenge text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON public.webauthn_challenges USING btree (expires_at);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_webauthn_credentials_account') THEN
    ALTER TABLE public.webauthn_credentials ADD CONSTRAINT fk_webauthn_credentials_account
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_webauthn_challenges_account') THEN
    ALTER TABLE public.webauthn_challenges ADD CONSTRAINT fk_webauthn_challenges_account
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;
