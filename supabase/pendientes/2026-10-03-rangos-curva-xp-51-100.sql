-- ============================================================
-- FULVO — CURVA DE XP 51–100 (feature/rangos-100)
-- Los umbrales 1–50 NO cambian (nadie pierde niveles). Se agregan los niveles 51–100.
--
-- Cómo se calculó:
--   · XP diaria típica ≈ 5.200 (jornada completa: mediana de los días con ≥11 juegos jugados en los
--     últimos 30 días ≈ 5.100, + recompensa diaria de 100 XP). Con tan pocos datos (18 días-usuario,
--     8 usuarios) no sirve la mediana de todos los días (2.449): ver el reporte en el PR/chat.
--   · XP total para el nivel 100 = 180 días × 5.200 = 936.000.
--   · Costo de cada nivel = 6.700 × 1,0321^k (k = 0…49): arranca justo por encima de lo que cuesta el
--     50 (6.500) y crece ~3 % por nivel, igual que 41–50 (+200 sobre ~6.000). Redondeado a 50 XP.
--     Nivel 51 cuesta 6.700 XP, nivel 100 cuesta 31.550 XP (≈ 6 días).
--   · Hoy ningún usuario supera los 130.700 XP del nivel 50 (máximo: 91.257 → nivel 43): nadie salta.
--
-- Idempotente. Las funciones get_user_level / user_level_of leen esta tabla, no hace falta tocar nada más.
-- Correr ANTES de sacar a producción el front de feature/rangos-100.
-- ============================================================
INSERT INTO public.level_thresholds (level, xp_required) VALUES
  (51, 137400),
  (52, 144300),
  (53, 151450),
  (54, 158800),
  (55, 166400),
  (56, 174250),
  (57, 182350),
  (58, 190750),
  (59, 199350),
  (60, 208250),
  (61, 217450),
  (62, 226950),
  (63, 236750),
  (64, 246850),
  (65, 257300),
  (66, 268050),
  (67, 279150),
  (68, 290650),
  (69, 302500),
  (70, 314700),
  (71, 327300),
  (72, 340350),
  (73, 353750),
  (74, 367650),
  (75, 381950),
  (76, 396750),
  (77, 411950),
  (78, 427700),
  (79, 443950),
  (80, 460750),
  (81, 478050),
  (82, 495900),
  (83, 514350),
  (84, 533350),
  (85, 553000),
  (86, 573250),
  (87, 594200),
  (88, 615800),
  (89, 638100),
  (90, 661100),
  (91, 684850),
  (92, 709350),
  (93, 734650),
  (94, 760750),
  (95, 787700),
  (96, 815500),
  (97, 844200),
  (98, 873850),
  (99, 904450),
  (100, 936000)
ON CONFLICT (level) DO UPDATE SET xp_required = EXCLUDED.xp_required;
