--
-- Urban Golf Database Schema
-- PostgreSQL database dump (schema only)
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- Enable pg_trgm extension for fuzzy search
SET search_path = public;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id integer NOT NULL,
    rating integer NOT NULL,
    message text NOT NULL,
    name character varying(100),
    email character varying(100),
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT feedback_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: feedback_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.feedback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.feedback_id_seq OWNED BY public.feedback.id;

--
-- Name: game_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_players (
    game_id text NOT NULL,
    player_id text NOT NULL,
    id bigint NOT NULL
);

--
-- Name: game_players_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.game_players_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.game_players_id_seq OWNED BY public.game_players.id;

--
-- Name: games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.games (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);

--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id text NOT NULL,
    name text NOT NULL
);

--
-- Name: scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scores (
    game_id text NOT NULL,
    player_id text NOT NULL,
    hole integer NOT NULL,
    strokes integer NOT NULL,
    id bigint NOT NULL,
    CONSTRAINT chk_hole CHECK ((hole >= 1 AND hole <= 18)),
    CONSTRAINT chk_strokes CHECK ((strokes >= -3 AND strokes <= 20))
);

--
-- Name: scores_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.scores_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.scores_id_seq OWNED BY public.scores.id;

--
-- Name: feedback id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback ALTER COLUMN id SET DEFAULT nextval('public.feedback_id_seq'::regclass);

--
-- Name: game_players id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players ALTER COLUMN id SET DEFAULT nextval('public.game_players_id_seq'::regclass);

--
-- Name: scores id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores ALTER COLUMN id SET DEFAULT nextval('public.scores_id_seq'::regclass);

--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);

--
-- Name: game_players game_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_pkey PRIMARY KEY (id);

--
-- Name: games games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);

--
-- Name: players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);

--
-- Name: scores scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_pkey PRIMARY KEY (id);

--
-- Name: scores scores_game_player_hole_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_game_player_hole_key UNIQUE (game_id, player_id, hole);

--
-- Name: game_players game_players_game_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT game_players_game_id_player_id_key UNIQUE (game_id, player_id);

--
-- Name: idx_games_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_games_name ON public.games USING btree (name);

--
-- Name: idx_players_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_name ON public.players USING btree (name);

--
-- Name: idx_scores_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scores_game_id ON public.scores USING btree (game_id);

--
-- Name: gin_games_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gin_games_name_trgm ON public.games USING gin (name gin_trgm_ops);

--
-- Name: gin_players_name_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gin_players_name_trgm ON public.players USING gin (name gin_trgm_ops);

--
-- Name: game_players fk_game_players_game; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT fk_game_players_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

--
-- Name: game_players fk_game_players_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_players
    ADD CONSTRAINT fk_game_players_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

--
-- Name: scores fk_scores_game; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT fk_scores_game FOREIGN KEY (game_id) REFERENCES public.games(id) ON DELETE CASCADE;

--
-- Name: scores fk_scores_player; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT fk_scores_player FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;

--
-- Optionale Identität: Accounts, OTP-Challenges, Sessions
--

CREATE TABLE public.accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    display_name text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.otp_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL,
    code_hash text NOT NULL,
    attempts integer NOT NULL DEFAULT 0,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_otp_codes_email ON public.otp_codes USING btree (email);

CREATE TABLE public.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    token_hash text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sessions_account ON public.sessions USING btree (account_id);

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT fk_sessions_account FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--
