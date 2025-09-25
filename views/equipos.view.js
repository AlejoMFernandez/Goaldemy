import { createPage } from "../pages/utils.js";

export function crearListadoEquipos(equipos) {
  let html = `<h1 class="page-title">Equipos</h1>`;
  html += `<section class="teams-grid">`;
  equipos.forEach((equipo) => {
    html += `
      <article class="team-card">
        ${equipo.logo ? `<img class="team-logo" src='${equipo.logo}' alt='${equipo.name}'>` : ""}
        <h2 class="team-name">${equipo.name}</h2>
        <div style="margin-top:10px">
          <a class="btn btn-primary btn-small" href="/equipos/${equipo.shortName}">Ver jugadores</a>
        </div>
      </article>`;
  });
  html += `</section>`;

  return createPage("equipos", html);
}

// creamos la vista para el detalle del equipo y sus jugadores
export function crearDetalleEquipo(equipo, jugadores) {
  let html = `<h1 class="page-title">${equipo.name}</h1>`;
  if (equipo.logo) {
    html += `<div style="text-align:center; margin-bottom:20px;">
      <img src="${equipo.logo}" alt="${equipo.name}" style="max-width:200px; height:auto; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,.12);">
    </div>`;
  }

  if (jugadores.length > 0) {
    html += `<div class="jugadores-grid">`;
    jugadores.forEach((jugador) => {
      html += `
        <div class="jugador-item">
          <div class="jugador-card">
            <div class="jugador-nombre">${jugador.name}</div>
            <div class="jugador-img-container">
              <img src="${jugador.imgUrl}" alt="${jugador.name}" class="jugador-img"/>
            </div>
          </div>
          <div class="jugador-acciones">
            <a href="/jugadores/${jugador.id}" class="jugador-btn btn-ver" title="Ver">
              <img src="/img/ver.svg" alt="Ver">
            </a>
            <a href="/jugadores/modificar/${jugador.id}" class="jugador-btn btn-editar" title="Editar">
              <img src="/img/editar.svg" alt="Editar">
            </a>
            <a
              href="/jugadores/eliminar/${jugador.id}"
              class="jugador-btn btn-eliminar"
              title="Eliminar"
            >
              <img src="/img/eliminar.svg" alt="Eliminar">
            </a>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  } else {
    html += `<p>No hay jugadores en este equipo.</p>`;
  }

  return createPage(equipo.name, html);
}