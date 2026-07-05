-- ============================================================
-- GOALDEMY — MEJORAS11: PANEL ADMIN DEL PASE DE BATALLA
--
-- Habilita que el admin (user_profiles.role = 'admin') gestione
-- el pase desde el panel: crear/editar temporadas, asignar los
-- cosméticos de cada nivel/track y editar el catálogo de cosméticos.
--
-- Sólo agrega políticas RLS de ESCRITURA (INSERT/UPDATE/DELETE)
-- para admins. La lectura pública ya existe (rewards-phase*/mejoras7).
-- No toca datos ni el motor del pase. Idempotente.
--
-- Correr DESPUÉS de mejoras7-pass-timezone.sql.
-- ============================================================

-- Patrón de "es admin" idéntico al de mejoras10-bug-reports.sql:
-- se resuelve contra user_profiles (tabla distinta) → sin recursión RLS.

-- ─── pass_seasons: escritura admin ──────────────────────────
DROP POLICY IF EXISTS "Pass seasons admin write" ON public.pass_seasons;
CREATE POLICY "Pass seasons admin write" ON public.pass_seasons
  FOR ALL
  USING      (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  WITH CHECK (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── pass_season_rewards: escritura admin ───────────────────
DROP POLICY IF EXISTS "Pass rewards admin write" ON public.pass_season_rewards;
CREATE POLICY "Pass rewards admin write" ON public.pass_season_rewards
  FOR ALL
  USING      (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  WITH CHECK (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── cosmetics: escritura admin (catálogo) ──────────────────
DROP POLICY IF EXISTS "Cosmetics admin write" ON public.cosmetics;
CREATE POLICY "Cosmetics admin write" ON public.cosmetics
  FOR ALL
  USING      (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'))
  WITH CHECK (exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ─── monthly_pass_tiers: lectura ya es pública; permitimos que
--     el admin lea siempre (por si en el futuro editamos umbrales).
--     Escritura del ladder queda fuera de v1 (se genera por fórmula).
-- ============================================================
