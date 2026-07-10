-- Cutover auf das kanonische Identitätsmodell (#106).
--
-- Bis hierher wurden Spieler-Einträge namensbasiert einem Konto zugeordnet
-- (POST /auth/profile: alle players mit gleichem Namen). Das ist fragil
-- (Namenskollisionen → vermischte Statistik) und wird durch die kanonische
-- Selbst-Identität (accounts.player_id, Migration 008) ersetzt.
--
-- Dieser Cutover leert die alten Zuordnungen bewusst in Dev UND Prod
-- (nur wenige Power-User). Alte Runden werden NICHT rückwirkend zugeordnet;
-- Konten etablieren ihre Identität neu, sobald sie ihren Anzeigenamen setzen
-- (legt den kanonischen Spieler an) und künftige Spiele mit der „Du"-Zeile
-- bzw. als Ersteller (created_by) erfassen.
--
-- Idempotent: erneutes Ausführen leert eine bereits leere Tabelle folgenlos.
DELETE FROM public.account_players;

-- accounts.player_id ist für Bestandskonten bereits NULL (Spalte neu in 008),
-- daher hier nichts weiter zurückzusetzen.
