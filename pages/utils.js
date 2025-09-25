export function createPage(title, content){
        let html = ""

        html += `<!DOCTYPE html>
        <html lang="es">
            <head>
                <meta charset="UTF-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>${title}</title>
                <link rel="stylesheet" href="/styles/css/style.css" />
            </head>
            <body>
                <header class="site-header">
                    <div class="container header-inner">
                        <div class="brand">Goaldemy</div>
                        <nav class="site-nav">
                            <a href="/equipos" class="nav-link">Equipos</a>
                            <a href="/jugadores" class="nav-link">Jugadores</a>
                            <a href="/jugadores/nuevo" class="btn btn-primary btn-small">Nuevo Jugador</a>
                        </nav>
                    </div>
                </header>
                <main class="container page-content">
                    ${content}
                </main>
                <footer class="site-footer">
                    <div class="container footer-inner">
                        <p>© 2025 Goaldemy</p>
                    </div>
                </footer>
            </body>
        </html>`

        return html
}

// Listado de jugadores
export function createJugadorList(jugadores){
    let html = "<table><tr><th>id</th><th>Nombre</th><th>Club</th><th>Posición</th><th>Edad</th></tr>"
    jugadores.forEach(jugador => {
        html += `
        <tr>
            <td>${jugador._id}</td>
            <td>${jugador.name}</td>
            <td>${jugador.club}</td>
            <td>${jugador.posicion}</td>
            <td>${jugador.edad}</td>
        </tr>`
    })
    html += "</table>"
    return html
}

// module.exports = {createPage, createProductList}
// export {createPage, createProductList}
export default {createPage, createJugadorList}