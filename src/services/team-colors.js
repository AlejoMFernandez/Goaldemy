/**
 * COLORES REALES DE CLUB (Adiviná el Crack — moodboard 09, sección 05)
 *
 * Principal + secundario de la camiseta titular, para los clubes que
 * aparecen en dataGAMES.json (los jugadores "extra" de players-extra.json
 * ya pertenecen a alguno de estos mismos clubes, no suman clubes nuevos).
 * Si algún día aparece un teamId nuevo que no está acá, se usa un gris
 * neutro en vez de romper o inventar un color al azar.
 */

export const TEAM_COLORS = {
  8455: { primary: '#034694', secondary: '#ffffff' },   // Chelsea
  8586: { primary: '#ffffff', secondary: '#132257' },   // Tottenham Hotspur
  10260: { primary: '#da291c', secondary: '#000000' },  // Manchester United
  8564: { primary: '#fb090b', secondary: '#000000' },   // Milan
  9875: { primary: '#12a0d7', secondary: '#ffffff' },   // Napoli
  9906: { primary: '#cb3524', secondary: '#ffffff' },   // Atlético Madrid
  9789: { primary: '#fde100', secondary: '#000000' },   // Borussia Dortmund
  10077: { primary: '#0f4c9a', secondary: '#ffd100' },  // Boca Juniors
  10076: { primary: '#ffffff', secondary: '#d70a0a' },  // River Plate
  10080: { primary: '#6cace4', secondary: '#ffffff' },  // Racing Club
  8650: { primary: '#c8102e', secondary: '#f6eb61' },   // Liverpool
  8634: { primary: '#004d98', secondary: '#a50044' },   // Barcelona
  9825: { primary: '#ef0107', secondary: '#063672' },   // Arsenal
  8636: { primary: '#010e80', secondary: '#000000' },   // Inter
  8633: { primary: '#ffffff', secondary: '#febe10' },   // Real Madrid
  9823: { primary: '#dc052d', secondary: '#0066b2' },   // Bayern München
  9847: { primary: '#004170', secondary: '#da020e' },   // Paris Saint-Germain
  8456: { primary: '#6cabdd', secondary: '#1c2c5b' },   // Manchester City
  8535: { primary: '#482e92', secondary: '#ffffff' },   // Fiorentina
  10252: { primary: '#670e36', secondary: '#95bfe5' },  // Aston Villa
  267810: { primary: '#633492', secondary: '#f2a900' }, // Orlando City
  8315: { primary: '#ee2523', secondary: '#ffffff' },   // Athletic Club
  101918: { primary: '#fcb316', secondary: '#002b5c' }, // Al Nassr FC
  10188: { primary: '#000000', secondary: '#ffffff' },  // Beşiktaş
  9902: { primary: '#0044a8', secondary: '#ffffff' },   // Ipswich Town
  8603: { primary: '#00954c', secondary: '#ffffff' },   // Real Betis
  2529: { primary: '#003da5', secondary: '#ffffff' },   // Al Hilal
  960720: { primary: '#f7b5cd', secondary: '#231f20' }, // Inter Miami CF
  8560: { primary: '#0033a0', secondary: '#ffffff' },   // Real Sociedad
  9752: { primary: '#7a1e3c', secondary: '#6cace4' },   // Trabzonspor
  8695: { primary: '#08195e', secondary: '#ffed00' },   // Fenerbahçe
  8686: { primary: '#8e1f2f', secondary: '#f0bc42' },   // Roma
  8514: { primary: '#ffffff', secondary: '#000000' },   // Santos
  10171: { primary: '#003d7c', secondary: '#ffffff' },  // Como
  9885: { primary: '#000000', secondary: '#ffffff' },   // Juventus
  9748: { primary: '#0b2d5c', secondary: '#c8102e' },   // Lyon
  8637: { primary: '#a90432', secondary: '#ffb300' },   // Galatasaray
  2530: { primary: '#00693e', secondary: '#ffffff' },   // Al Ahli
  6397: { primary: '#0f2143', secondary: '#a41e34' },   // Chicago Fire FC
  867280: { primary: '#000000', secondary: '#c39e6d' }, // Los Angeles FC
  10084: { primary: '#002664', secondary: '#ffd100' },  // Rosario Central
}

const FALLBACK = { primary: '#475569', secondary: '#94a3b8' } // gris neutro

export function colorsForTeam(teamId) {
  return TEAM_COLORS[teamId] || FALLBACK
}
