import { createPage } from "../pages/utils.js";

export function crearListadoJugadores(jugadores) {
  let html = "";
  html += `<h1 class="page-title">Jugadores</h1>`;

  // Obtener clubes únicos con logo
  const clubesMap = {};
  jugadores.forEach((j) => {
    if (j.club && j.clubLogo) {
      clubesMap[j.club] = j.clubLogo;
    }
  });
  const clubes = Object.entries(clubesMap);

  // Filtro visual por club (escudos)
  html += `<div class="club-filter">`;
  clubes.forEach(([club, logo]) => {
    html += `
      <a href="/jugadores?club=${encodeURIComponent(club)}" title="${club}">
        <img src="${logo}" alt="${club}">
      </a>
    `;
  });
  html += `</div>`;

  // Cuadrícula de jugadores
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
          <a href="/jugadores/eliminar/${jugador.id}" class="jugador-btn btn-eliminar" title="Eliminar">
            <img src="/img/eliminar.svg" alt="Eliminar">
          </a>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  return createPage("Jugadores", html);
}

export function crearDetalleJugador(jugador) {
  let html = "";
  if (jugador) {
    html += `<section class="player-detail">
      ${jugador.imgUrl ? `<img src="${jugador.imgUrl}" alt="${jugador.name}">` : ""}
      <div>
        <h1>${jugador.name}</h1>
        ${jugador.club ? `<p><strong>Club:</strong> ${jugador.club}</p>` : ""}
        ${jugador.shirtNumber ? `<p><strong>Número:</strong> ${jugador.shirtNumber}</p>` : ""}
        ${jugador.cname ? `<p><strong>Nacionalidad:</strong> ${jugador.cname}</p>` : ""}
        ${jugador.posicion || (jugador.role.fallback) ? `<p><strong>Posición:</strong> ${jugador.role.fallback}</p>` : ""}
        ${jugador.age ? `<p><strong>Edad:</strong> ${jugador.age}</p>` : ""}
        ${jugador.height ? `<p><strong>Altura:</strong> ${jugador.height} cm</p>` : ""}
        ${jugador.transferValue ? `<p><strong>Valor de Transferencia:</strong> $${jugador.transferValue}</p>` : ""}
      </div>
    </section>
    <a href="/jugadores" class="back-link">← Volver al listado</a>`;
    return createPage(jugador.name, html);
  } else {
    return createPage("Error", "<p>Jugador no encontrado</p>");
  }
}

export function formularioNuevoJugador() {
  let html = `<form action='/jugadores/nuevo' method='post' class='form-card'>`;
  html += `<div class='form-row'>
            <div>
              <label>Nombre</label>
              <input type='text' placeholder='Nombre del jugador' name='name' />
            </div>
            <div>
              <label>Club</label>
              <input type='text' placeholder='Club' name='club'/>
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Nacionalidad</label>
              <input type='text' placeholder='Nacionalidad' name='cname'/>
            </div>
            <div>
              <label>Posición</label>
              <input type='text' placeholder='Posición' name='posicion'/>
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Edad</label>
              <input type='number' placeholder='Edad' name='age'/>
            </div>
            <div>
              <label>Altura (cm)</label>
              <input type='number' placeholder='Altura (cm)' name='height'/>
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Número de camiseta</label>
              <input type='number' placeholder='Número de camiseta' name='shirtNumber'/>
            </div>
            <div>
              <label>Valor de Transferencia</label>
              <input type='number' placeholder='Valor de Transferencia' name='transferValue'/>
            </div>
          </div>`;
  html += `<input type='submit' value='Guardar' />`;
  html += `</form>`;
  return createPage("Nuevo jugador", html);
}

export function formularioModificarJugador(jugador) {
  let html = `<form action='/jugadores/modificar/${jugador.id || ""}' method='post' class='form-card'>`;
  html += `<div class='form-row'>
            <div>
              <label>Nombre</label>
              <input type='text' placeholder='Nombre del jugador' name='name' value='${jugador.name || ""}' />
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Nacionalidad</label>
              <input type='text' placeholder='Nacionalidad' name='cname' value='${jugador.cname || ""}'/>
            </div>
            <div>
              <label>Posición</label>
              <input type='text' placeholder='Posición' name='posicion' value='${jugador.role.fallback || ""}'/>
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Edad</label>
              <input type='number' placeholder='Edad' name='age' value='${jugador.age || ""}'/>
            </div>
            <div>
              <label>Altura (cm)</label>
              <input type='number' placeholder='Altura (cm)' name='height' value='${jugador.height || ""}'/>
            </div>
          </div>`;
  html += `<div class='form-row'>
            <div>
              <label>Número de camiseta</label>
              <input type='number' placeholder='Número de camiseta' name='shirtNumber' value='${jugador.shirtNumber || ""}'/>
            </div>
            <div>
              <label>Valor de Transferencia</label>
              <input type='number' placeholder='Valor de Transferencia' name='transferValue' value='${jugador.transferValue || ""}'/>
            </div>
          </div>`;
  html += "<input type='submit' value='Editar' />";
  html += "</form>";
  return createPage("Modificar jugador", html);
}

export function formularioEliminarJugador(jugador) {
  let html = `<form action='/jugadores/eliminar/${jugador._id || ""}' method='post'>`;
  html += `<div>Nombre: ${jugador.name}</div>`;
  html += `<div>Club: ${jugador.club || ""}</div>`;
  html += `<div>Nacionalidad: ${jugador.cname || ""}</div>`;
  html += `<div>Posición: ${jugador.posicion || (jugador.role && jugador.role.fallback) || ""}</div>`;
  html += `<div>Edad: ${jugador.age || ""}</div>`;
  html += `<div>Altura: ${jugador.height || ""} cm</div>`;
  html += `<div>Número: ${jugador.shirtNumber || ""}</div>`;
  html += `<div>Valor de Transferencia: ${jugador.transferValue ? "$" + jugador.transferValue : ""}</div>`;
  html += "<input type='submit' value='Eliminar' />";
  html += "</form>";
  html += `<a href="/jugadores">Volver</a>`;
  return html;
}
