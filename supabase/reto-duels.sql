-- ════════════════════════════════════════════════════════════
--  DUELO ASÍNCRONO — comparar el Reto del día contra tus amigos
-- ════════════════════════════════════════════════════════════
--  Reutiliza infraestructura que ya existe: el Reto del día ya es el MISMO
--  desafío para todos (semilla por fecha, ver daily-reto.js) y reto_claims
--  ya guarda el resultado de cada usuario logueado que lo jugó (incluida
--  la fecha, vía p_day_key — ver reto-claim.sql). Lo único que faltaba era
--  poder VER el resultado de un amigo (RLS lo bloquea por diseño) y poder
--  avisarle "yo ya jugué, ¿te animás?".
--
--  Correr en el SQL Editor de Supabase. Requiere reto-claim.sql ya corrido.
-- ════════════════════════════════════════════════════════════

-- Tablero del día: para cada amigo (conexión aceptada), su resultado de HOY
-- si ya jugó (played=true) o null si todavía no. p_day_key lo manda el front
-- con el mismo criterio de daily-reto.js (fecha LOCAL del dispositivo) para
-- no desalinearse con cómo se guardó reto_claims.day_key.
CREATE OR REPLACE FUNCTION public.get_reto_duel_board(p_day_key TEXT)
RETURNS TABLE (
  friend_id  UUID,
  display_name TEXT,
  avatar_url TEXT,
  corrects   INTEGER,
  total      INTEGER,
  played     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    rc.corrects,
    rc.total,
    (rc.user_id IS NOT NULL) AS played
  FROM public.connections c
  JOIN public.user_profiles p
    ON p.id = (CASE WHEN c.user_a = auth.uid() THEN c.user_b ELSE c.user_a END)
  LEFT JOIN public.reto_claims rc
    ON rc.user_id = p.id AND rc.day_key = p_day_key
  WHERE c.status = 'accepted'
    AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ORDER BY played DESC, rc.corrects DESC NULLS LAST, p.display_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_reto_duel_board(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_reto_duel_board(TEXT) TO authenticated;

-- Notificación "te desafío" — no otorga nada, solo avisa. Se limita a 1 por
-- (retador, retado, día) para que no se pueda spamear a un amigo.
CREATE TABLE IF NOT EXISTS public.duel_challenges (
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_key       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenger_id, opponent_id, day_key)
);

ALTER TABLE public.duel_challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "duel_challenges read own" ON public.duel_challenges;
CREATE POLICY "duel_challenges read own" ON public.duel_challenges
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = challenger_id OR (select auth.uid()) = opponent_id);

CREATE OR REPLACE FUNCTION public.send_duel_challenge(p_opponent_id UUID, p_day_key TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'auth');
  END IF;
  IF p_opponent_id IS NULL OR p_opponent_id = uid THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_target');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.connections
    WHERE status = 'accepted'
      AND ((user_a = uid AND user_b = p_opponent_id) OR (user_a = p_opponent_id AND user_b = uid))
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'not_friends');
  END IF;

  BEGIN
    INSERT INTO public.duel_challenges (challenger_id, opponent_id, day_key)
      VALUES (uid, p_opponent_id, p_day_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN json_build_object('ok', false, 'error', 'already_sent');
  END;

  INSERT INTO public.notifications (type, to_user, from_user, payload)
    VALUES ('duel_challenge', p_opponent_id, uid, json_build_object('day_key', p_day_key)::jsonb);

  RETURN json_build_object('ok', true);
END$$;

REVOKE ALL ON FUNCTION public.send_duel_challenge(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_duel_challenge(UUID, TEXT) TO authenticated;
