-- ============================================================
-- FULVO — RANGOS (feature/rangos-forja): nombre de las cartas del ícono de rango
-- "Ícono de rango <Categoría>" (ej. "Ícono de rango Ícono" cuando entre el rango 80–89).
-- Solo cambia el NOMBRE visible: los code / style_key NO se tocan, así nadie pierde lo que tiene.
-- El front ya usa este texto en las cartas de ascenso (prize-card.js); esto alinea la colección/tienda.
-- Idempotente. Correr cuando quieras, no depende de otro SQL.
-- ============================================================
UPDATE public.cosmetics SET name = 'Ícono de rango Aficionado'  WHERE code = 'icon_rank_aficionado';
UPDATE public.cosmetics SET name = 'Ícono de rango Juvenil'     WHERE code = 'icon_rank_juvenil';
UPDATE public.cosmetics SET name = 'Ícono de rango Amateur'     WHERE code = 'icon_rank_amateur';
UPDATE public.cosmetics SET name = 'Ícono de rango Reserva'     WHERE code = 'icon_rank_reserva';
UPDATE public.cosmetics SET name = 'Ícono de rango Profesional' WHERE code = 'icon_rank_profesional';
UPDATE public.cosmetics SET name = 'Ícono de rango Crack'       WHERE code = 'icon_rank_crack';
