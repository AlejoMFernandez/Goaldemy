# Vestuario nuevo · especificación de implementación

Aprobado por Alejo el 28/09/2026. **Se implementa como se ve en `moodboard.html`** (abrilo en el navegador): cada borde y banner ya está dibujado ahí con CSS, y la app tiene que verse y moverse igual, sin versiones propias.

Datos: `vestuario-2026-09.sql` (12 bordes, 15 banners, 30 títulos, con reglas de desbloqueo).

## Mapa moodboard → app

En el moodboard, cada borde es `.fr.f-<clave>` alrededor de `.av` (el avatar), y cada banner es `.bn.b-<clave>` con sus capas internas (`.fx`, `.ball`, `.bug`, etc.). Algunos tienen piezas extra que arma el JS del moodboard (objetos `extra` para bordes y `bx` para banners): SVG, chapitas, estrellas, partículas.

### Bordes (`FRAME_STYLES` en `src/services/cosmetics.js`)

| style_key | Clase en el moodboard | Pieza extra | Notas |
|---|---|---|---|
| chalk | f-tiza | SVG del círculo de tiza (`tiza`) | Sin animación |
| grass | f-cesped | — | |
| net | f-red | — | |
| level_plate | f-nivel | Chapita `NV {nivel}` abajo | **Dinámico**: muestra el nivel real del usuario |
| captain | f-capitan | Cinta `C` abajo a la derecha | |
| fence | f-alambrado | — | |
| led | f-led | — | Anima un barrido (`steps`) |
| floodlights | f-reflectores | — | Gira; el avatar contra-gira |
| laurel | f-laurel | SVG de hojas (`laurel`) | |
| streak | f-racha / f-racha0 | Chapita `🔥 N` | **Dinámico**: el aro se llena según la racha diaria actual (conic-gradient al %), sin racha = aro gris `f-racha0`. Definir el tope (ej.: 30 días = 100 %) |
| fire_ring | f-fuego | — | Gira + titila |
| stars | f-estrellas | 5 estrellas en órbita (`.orb`) | |

Hoy `FRAME_STYLES` solo da `wrap` + `pad` (clases en un wrapper). Los bordes con pieza extra necesitan un **slot de overlay** en el componente del avatar (`UserAvatar.vue` y donde se use `frameStyle`), por ejemplo un `<FrameOverlay :style-key :level :streak />` que dibuje el SVG o la chapita encima. Los estilos que no se pueden hacer con Tailwind van en `style.css` como `.frm-<clave>`, igual que `frm-prismatic` y `frm-champion`.

### Banners (`BANNER_STYLES` + `.bnr-*` en `style.css`)

| style_key | Clase en el moodboard | Capas internas |
|---|---|---|
| mowed | b-rayas | `.fx` (círculo central y línea) |
| penalty | b-penal | `.area`, `.d`, `.ball` |
| leather | b-cuero | SVG de costuras y tiento |
| scoreboard | b-marcador | `.fx` con el resultado. Idea: mostrar el mejor resultado del usuario; si no, un `3 - 0` fijo |
| away_kit | b-banda | `.num` (dorsal `10` fijo por ahora) |
| live | b-vivo | `.fx`, `.bug` (EN VIVO + resultado + reloj que corre), `.lt` |
| var | b-var | `.zone` (líneas del offside animadas), `.vt` |
| tactics | b-pizarra | SVG de tiza |
| newspaper | b-diario | `.hd` (titular), `.cl` (columnas). **El texto del usuario va oscuro** en este banner |
| rain | b-lluvia | `.cone`, `.fx` |
| heatmap | b-calor | `.heat`, `.pitch` |
| lights | b-reflectores | 4 × `.tw` con retraso escalonado |
| passmap | b-pases | SVG de nodos y pases |
| commentary | b-relato | `.gol`, `.wave` con 30 barras |
| ticker_tape | b-papelitos | 36 papelitos `<i>` |

Hoy los banners son una sola clase de fondo. Los nuevos llevan capas, así que hace falta un componente (por ejemplo `BannerScene.vue`) que reciba `styleKey` y dibuje las capas. Así el header del perfil, la fila del ranking, la carta `PrizeCard` y el vestuario usan el mismo componente.

### Títulos

Son solo filas en la base de datos (`name` = texto). Lo nuevo es el **tratamiento visual por rareza**, igual que `.tt.common/.rare/.epic/.legendary` del moodboard:
- **Común:** texto liso.
- **Rara:** rombo celeste delante y marco fino.
- **Épica:** degradé violeta, un poco torcido como un sello.
- **Legendaria:** Anton dorado con un brillo que pasa.

Aplicarlo en todos los lugares donde se muestra el título equipado (usan `titleRarity`).

## Reglas de rendimiento y movimiento

- **Los avatares chicos no se animan.** El rail de amigos, el ranking y el chat muestran la versión quieta del borde (mismo dibujo, sin `animation`). Las animaciones van solo en tamaños medianos y grandes (perfil, vestuario, escenas de desbloqueo). Si no, una lista de 50 filas con bordes animados pesa.
- En los avatares chicos, los bordes con pieza extra solo muestran lo que se lee: la chapita de nivel y la de racha sí, el laurel y las estrellas no.
- `prefers-reduced-motion`: todo quieto, igual que en el moodboard.
- Los banners animados (lluvia, papelitos, relato, en vivo, VAR, luces, pases) se pausan fuera de pantalla (IntersectionObserver o `animation-play-state`).

## Integración con lo que ya existe

- **Vestuario / álbum** (`CosmeticsCollection.vue`): los nuevos entran solos por la base de datos, pero hay que sumar las animaciones de equipar para los tipos nuevos, siguiendo el patrón actual (borde gira y deja un anillo, banner se barre, título se estampa).
- **`PrizeCard` y `RarityReveal`:** tienen que dibujar el borde o el banner real con los componentes nuevos. Nada de íconos genéricos.
- **Desbloqueo por logro:** `fetchCosmeticsByAchievement` ya los encuentra por `unlock_achievement`, así que la escena del logro los muestra sin cambios.

## Íconos (misma tanda)

- Los 23 aprobados ya están como PNG con su clave en `public/cosmetics/icons/`: bufanda, bombo, corneta, silbato, banderin, tarjeta_roja, cinta, cronometro, pizarra, tunel, lobo, toro, leon, tiburon, aguila, dragon, zapatillas, arco_oxidado, pelota_trapo, taco, botin_alado, pelota_oro, camiseta_10.
- Correr `node scripts/build-icons.mjs` y sumar las claves a `RASTER_ICONS` en `CosmeticIcon.vue`.
- **No crear las filas de cosméticos de íconos todavía**: cómo se consiguen se decide aparte. Tampoco usar bengala, trapo, chilena, tiro_libre ni atajada, que se van a rehacer.
