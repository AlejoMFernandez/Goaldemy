#!/usr/bin/env node
/**
 * Genera supabase/pendientes/2026-11-24-11-colecciones.sql desde src/data/collections.js
 * y src/services/tiers.js (kit por rango).
 *
 *   node scripts/progresion-colecciones.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { COLLECTIONS } from '../src/data/collections.js'
import { TIERS, TIER_UNLOCKS } from '../src/services/tiers.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const q = (v) => v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`
const RARITY_BY_METAL = { bronce: 'common', plata: 'rare', oro: 'epic', diamante: 'legendary', holo: 'legendary' }

// ── Kit por rango (11) ─────────────────────────────────────
const kitRows = []
TIERS.forEach((t, i) => {
  const tu = TIER_UNLOCKS[t.key]
  const r = RARITY_BY_METAL[t.kit.metal]
  const col = COLLECTIONS.find(c => c.tierKey === t.key).key
  kitRows.push(`  (${q(`icon_rank_${t.key}`)}, 'icon', ${q(`Ícono de rango ${t.label}`)}, ${q(r)}, ${q(tu.icon)}, ${t.minLevel}, false, ${60 + i}, ${q(col)}, 'kit', true)`)
  kitRows.push(`  (${q(`frame_rank_${t.key}`)}, 'frame', ${q(`Medallón ${t.label}`)}, ${q(r)}, ${q(tu.frame)}, ${t.minLevel}, false, ${50 + i}, ${q(col)}, 'kit', true)`)
  kitRows.push(`  (${q(`banner_tier_${t.key}`)}, 'banner', ${q(`Banner ${t.label}`)}, ${q(r)}, ${q(tu.banner)}, ${t.minLevel}, false, ${40 + i}, ${q(col)}, 'kit', true)`)
})

// ── Piezas de colección nuevas (no kit, no legacy) ────────
const pieceRows = []
const legacy = []
let sort = 300
for (const c of COLLECTIONS) {
  for (const p of c.pieces) {
    if (p.route === 'kit') continue
    if (p.legacy) { legacy.push({ code: p.legacy, col: c.key, route: p.route, name: p.name }); continue }
    // Activo solo lo que no necesita arte: títulos del camino y títulos premio.
    const active = p.kind === 'title' && (p.route === 'camino' || p.route === 'premio')
    const unlock = p.route === 'camino' ? p.level : 999
    pieceRows.push(`  (${q(p.code)}, ${q(p.kind)}, ${q(p.name)}, ${q(p.rarity)}, ${q(p.kind === 'title' ? null : p.code)}, ${unlock}, false, ${q(p.achievement)}, ${sort++}, ${q(c.key)}, ${q(p.route)}, ${active})`)
  }
}

const sql = `-- ============================================================
-- FULVO · 2026-11-24 · 11 · COLECCIONES POR CATEGORÍA + KIT DE RANGO v2
-- ============================================================
-- QUÉ:
--   1. Columnas nuevas en public.cosmetics: collection (key de colección) y
--      collection_route ('kit' | 'camino' | 'logro' | 'premio' | 'legado' = ya existía y conserva su desbloqueo).
--   2. Kit por rango para los 11 rangos (ícono de rango, medallón, banner) con el
--      copy nuevo ("Ícono de rango Ícono"…). Upsert: los 6 que ya existían cambian
--      nombre y rareza por metal (bronce=common, plata=rare, oro=epic, diamante/holo=legendary).
--   3. Piezas de las 11 colecciones (src/data/collections.js). Sin arte todavía:
--      íconos/banners/bordes quedan active=false; los TÍTULOS del camino y de premio
--      quedan activos (no necesitan arte). Las piezas 'logro' apuntan a un
--      unlock_achievement PROPUESTO (los logros hay que crearlos).
--   4. Cosméticos existentes mapeados por nombre (Fuego, Laurel, GOAT).
--   5. grant_cosmetic(): si el usuario YA tenía el cosmético, lo convierte en
--      Fichas (raro 250 · épico 600 · legendario 1250; común 0).
--      + REVOKE de EXECUTE para public/anon/authenticated (antes se podía llamar
--      por RPC desde el cliente; con Fichas sería farmeable).
--   6. claim_collection_prize(p_collection): entrega el premio de una colección
--      completa (todas las piezas no-premio, ACTIVAS y en propiedad).
-- POR QUÉ: relanzamiento 1–100 · cada categoría trae kit + colección (decisión de Alejo).
-- DEPENDE DE: rewards-phase4.sql, rewards-phase4c.sql (unlock_achievement, owns_cosmetic),
--   rank-cosmetics.sql, category-banners.sql, mejoras11-currency-shop.sql (award_fichas; opcional).
-- ROLLBACK:
--   DELETE FROM public.cosmetics WHERE code LIKE 'col\\_%' ESCAPE '\\';
--   DELETE FROM public.cosmetics WHERE code IN (${TIERS.slice(6).flatMap(t => [`'icon_rank_${t.key}'`, `'frame_rank_${t.key}'`, `'banner_tier_${t.key}'`]).join(', ')});
--   -- volver a correr rank-cosmetics.sql y category-banners.sql (nombres/rarezas viejos)
--   -- volver a correr el bloque grant_cosmetic de rewards-phase4.sql (versión SQL sin Fichas)
--   DROP FUNCTION IF EXISTS public.claim_collection_prize(TEXT);
--   ALTER TABLE public.cosmetics DROP COLUMN IF EXISTS collection, DROP COLUMN IF EXISTS collection_route;
-- Idempotente. Generado por scripts/progresion-colecciones.mjs — no editar a mano.
-- ============================================================

BEGIN;

-- 1) Columnas
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS collection_route TEXT;
ALTER TABLE public.cosmetics ADD COLUMN IF NOT EXISTS unlock_achievement TEXT;
CREATE INDEX IF NOT EXISTS idx_cosmetics_collection ON public.cosmetics (collection);

-- 2) Kit por rango (11 rangos × ícono/medallón/banner)
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, sort_order, collection, collection_route, active) VALUES
${kitRows.join(',\n')}
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, sort_order = EXCLUDED.sort_order,
  collection = EXCLUDED.collection, collection_route = EXCLUDED.collection_route;

-- 3) Piezas de colección (active NO se pisa en re-corridas: se prende a mano cuando hay arte/logro)
INSERT INTO public.cosmetics (code, type, name, rarity, style_key, unlock_level, premium_only, unlock_achievement, sort_order, collection, collection_route, active) VALUES
${pieceRows.join(',\n')}
ON CONFLICT (code) DO UPDATE SET
  type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, style_key = EXCLUDED.style_key,
  unlock_level = EXCLUDED.unlock_level, premium_only = EXCLUDED.premium_only, unlock_achievement = EXCLUDED.unlock_achievement,
  sort_order = EXCLUDED.sort_order, collection = EXCLUDED.collection, collection_route = EXCLUDED.collection_route;

-- 4) Cosméticos existentes que entran a una colección (no se tocan sus reglas de desbloqueo)
${legacy.map(l => `UPDATE public.cosmetics SET collection = ${q(l.col)}, collection_route = 'legado' WHERE code = ${q(l.code)};  -- ${l.name}`).join('\n')}

-- 5) grant_cosmetic: duplicado → Fichas por rareza
CREATE OR REPLACE FUNCTION public.grant_cosmetic(p_user_id UUID, p_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rarity TEXT;
  v_dup BOOLEAN;
  v_fichas INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_code IS NULL THEN RETURN; END IF;
  SELECT rarity INTO v_rarity FROM public.cosmetics WHERE code = p_code;
  IF v_rarity IS NULL THEN RETURN; END IF;

  -- "Ya lo tenía": fila explícita o lo poseía por nivel/logro
  v_dup := EXISTS(SELECT 1 FROM public.user_cosmetics WHERE user_id = p_user_id AND cosmetic_code = p_code)
           OR public.owns_cosmetic(p_user_id, p_code);

  INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
  VALUES (p_user_id, p_code) ON CONFLICT DO NOTHING;

  IF v_dup THEN
    v_fichas := CASE v_rarity WHEN 'rare' THEN 250 WHEN 'epic' THEN 600 WHEN 'legendary' THEN 1250 ELSE 0 END;
    IF v_fichas > 0 AND to_regprocedure('public.award_fichas(uuid,integer,text,jsonb)') IS NOT NULL THEN
      PERFORM public.award_fichas(p_user_id, v_fichas, 'cosmetic_duplicate',
        jsonb_build_object('code', p_code, 'rarity', v_rarity));
    END IF;
  END IF;
END$$;
REVOKE ALL ON FUNCTION public.grant_cosmetic(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_cosmetic(UUID, TEXT) FROM anon, authenticated;

-- 6) Premio por colección completa
--    Requiere TODAS las piezas no-premio (activas y en propiedad). Mientras falte arte
--    (piezas active=false) la colección no se puede completar: a propósito.
--    'album' (GOAT) = todas las piezas no-premio de TODAS las colecciones.
CREATE OR REPLACE FUNCTION public.claim_collection_prize(p_collection TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid UUID := auth.uid();
  v_missing INTEGER;
  v_prizes TEXT[];
BEGIN
  IF uid IS NULL THEN RETURN json_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT array_agg(code) INTO v_prizes FROM public.cosmetics
  WHERE collection = p_collection AND collection_route = 'premio';
  IF v_prizes IS NULL THEN RETURN json_build_object('ok', false, 'error', 'no_prize'); END IF;

  IF NOT EXISTS (SELECT 1 FROM unnest(v_prizes) c
                 WHERE NOT EXISTS (SELECT 1 FROM public.user_cosmetics uc WHERE uc.user_id = uid AND uc.cosmetic_code = c)) THEN
    RETURN json_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  SELECT COUNT(*) INTO v_missing FROM public.cosmetics c
  WHERE c.collection IS NOT NULL
    AND c.collection_route <> 'premio'
    AND (p_collection = 'album' OR c.collection = p_collection)
    AND NOT (c.active AND public.owns_cosmetic(uid, c.code));
  IF v_missing > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'incomplete', 'missing', v_missing);
  END IF;

  INSERT INTO public.user_cosmetics (user_id, cosmetic_code)
  SELECT uid, c FROM unnest(v_prizes) c ON CONFLICT DO NOTHING;
  RETURN json_build_object('ok', true, 'collection', p_collection, 'granted', to_json(v_prizes));
END$$;
GRANT EXECUTE ON FUNCTION public.claim_collection_prize(TEXT) TO authenticated;

COMMIT;

-- Verificación
-- SELECT collection, collection_route, COUNT(*), COUNT(*) FILTER (WHERE active) AS activos
-- FROM public.cosmetics WHERE collection IS NOT NULL GROUP BY 1, 2 ORDER BY 1, 2;
`
const out = resolve(ROOT, 'supabase/pendientes/2026-11-24-11-colecciones.sql')
writeFileSync(out, sql)
console.log(`SQL → ${out} · kit ${kitRows.length} · piezas ${pieceRows.length} · legacy ${legacy.length}`)
