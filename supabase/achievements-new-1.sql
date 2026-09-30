-- Logros nuevos #1 (23): tiempo y ayudas, por juego, colección, varios días,
-- sostener el nivel y hazañas repetidas.
-- Safe to run multiple times (upsert por code).
--
-- QUÉ HACE: solo da de alta el catálogo. La lógica de desbloqueo vive en el
-- cliente (src/services/achievement-rules.js + checkNewAchievements() en
-- achievement-triggers.js), que calcula todo desde game_sessions y user_daily_claims
-- y desbloquea con el RPC unlock_achievement (ya existente, SECURITY DEFINER).
-- No hay que tocar ninguna función ni tabla: `active` ya existe (achievements-curation-1).
--
-- XP por rareza (columna points; la rareza en sí vive en src/services/achievement-icons.js,
-- igual que el resto de los logros):
--   común 15 · rara 35 · épica 80 · legendaria 180
--
-- Ninguno se desbloquea en la primera partida de una cuenta nueva (guarda
-- MIN_PRIOR_GAMES en achievement-rules.js).
--
-- IMPORTANTE: los logros que dependen de dificultad, ayudas usadas, escudo o
-- segundos sobrantes solo cuentan las partidas jugadas DESDE que el cliente
-- guarda esos datos en la sesión (mismo deploy que este SQL). Las sesiones
-- viejas no los tienen y no se pueden reconstruir.

alter table public.achievements add column if not exists active boolean not null default true;

insert into public.achievements (code, name, description, points, active)
values
  -- ⏱ Tiempo y ayudas
  ('tiempo_descuento',  'Tiempo de descuento',   'Ganá con el último acierto en los últimos 3 segundos del reloj',                35,  true),
  ('ni_la_mitad',       'Ni la mitad',           'Ganá con ¡Basta! usando menos de la mitad del reloj',                            35,  true),
  ('relampago',         'Relámpago',             'Ganá con ¡Basta! en Difícil con el 40 % o más del tiempo de sobra',              80,  true),
  ('salvado_escudo',    'Salvado por el escudo', 'Que el escudo te salve de un error y ganá esa partida',                          15,  true),
  ('ascenso',           'Ascenso',               'Ganá en Difícil todos los juegos contrarreloj',                                  80,  true),

  -- 🎮 Por juego
  ('ojo_halcon',        'Ojo de halcón',         'Ganá Adiviná el Crack en 3 intentos o menos',                                    80,  true),
  ('cadena_oro',        'Cadena de oro',         'Completá la cadena de Mayor o Menor sin cortarla',                               80,  true),
  ('scout',             'Scout',                 'Acertá 10 cromos seguidos en Duelo de Stats sin un solo error',                  35,  true),
  ('once_gala',         'Once de gala',          'Completá el Once Ideal con más de 1 minuto de sobra',                            80,  true),

  -- 🗂 Colección
  ('trotamundos',       'Trotamundos',           'Ganá al menos una vez en 7 juegos distintos',                                    35,  true),
  ('todoterreno',       'Todoterreno',           'Ganá al menos una vez en todos los juegos',                                      80,  true),
  ('coleccionista',     'Coleccionista',         'Abrí 7 sobres del día',                                                          35,  true),

  -- 📅 Varios días
  ('semana_primera',    'Semana en Primera',     'Ganá al menos un juego en Difícil 7 días seguidos',                              80,  true),
  ('relojero',          'Relojero',              'Ganá con ¡Basta! 3 días seguidos',                                               80,  true),
  ('especialista',      'Especialista',          'Ganá el mismo juego 14 días seguidos',                                           80,  true),
  ('doble_jornada',     'Doble jornada',         'Ganá todos los juegos del día 2 días seguidos',                                  180, true),

  -- 🛡 Sostener el nivel
  ('invicto',           'Invicto',               '10 victorias seguidas sin ninguna derrota',                                      80,  true),
  ('invicto_temporada', 'Invicto de temporada',  '30 victorias seguidas sin ninguna derrota',                                      180, true),
  ('sin_red',           'Sin red',               'Ganá 5 contrarreloj seguidos en Difícil sin usar ninguna ayuda',                 80,  true),
  ('jornada_primera',   'Jornada de Primera',    'Ganá todos los juegos del día en Difícil',                                       180, true),

  -- 🔁 Hazañas repetidas
  ('fuego_azul',        'Fuego azul',            'Llegá a la llama azul (10 seguidas) en 3 juegos distintos el mismo día',         80,  true),
  ('cazador_cracks',    'Cazador de cracks',     'Ganá Adiviná el Crack en 3 intentos o menos, en 5 días distintos',               80,  true),
  ('enciclopedia',      'Enciclopedia',          'Sumá 1000 respuestas correctas en total',                                        180, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  points = excluded.points,
  active = excluded.active;
