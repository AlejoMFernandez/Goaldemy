import { createPage } from "../pages/utils.js"
import * as services from "../services/jugadores.service.js"
import * as views from "../views/jugadores.view.js"

// Obtener jugadores, con filtro opcional por club
export function getJugadores(req, res){
    // El filtro puede venir por query string: ?club=River
    const filter = {}
    if (req.query.club) {
        filter.club = req.query.club
    }
    services.getJugadores(filter)
        .then(jugadores => res.send(views.crearListadoJugadores(jugadores)))
}

// Obtener jugador por ID
export function getJugadorById(req, res){
    const id = req.params.id
    services.getJugadorById(id)
        .then(jugador => res.send(views.crearDetalleJugador(jugador)))
}

// Formulario para nuevo jugador
export function formularioNuevoJugador(req, res){
    res.send(views.formularioNuevoJugador())
}

// Guardar nuevo jugador
export function guardarJugador(req, res){
    const jugador = {
        // Ajusta los campos según tu modelo de jugador
        name: req.body.name,
        club: req.body.club,
        posicion: req.body.posicion,
        edad: req.body.edad
    }
    services.guardarJugador(jugador)
        .then(() => res.send(createPage("Jugador Creado", `<p>Nombre: ${jugador.name} - Club: ${jugador.club} - Posición: ${jugador.posicion} - Edad: ${jugador.edad}</p>`)))
}

// Formulario para modificar jugador
export function formularioModificarJugador(req, res){
    const id = req.params.id
    services.getJugadorById(id)
        .then(jugador => res.send(views.formularioModificarJugador(jugador)))
}

// Editar jugador
export function editarJugador(req, res){
    const id = req.params.id
    const jugador = {
        name: req.body.name,
        club: req.body.club,
        posicion: req.body.posicion,
        edad: req.body.edad
    }
    services.editarJugador(id, jugador)
        .then(() => res.send(views.crearDetalleJugador(jugador)))
        .catch(() => res.send(views.crearDetalleJugador()))
}

// Formulario para eliminar jugador
export function formularioEliminarJugador(req, res){
    const id = req.params.id
    services.getJugadorById(id)
        .then(jugador => res.send(views.formularioEliminarJugador(jugador)))
}

// Eliminar jugador (soft delete)
export function eliminarJugador(req, res){
    const id = req.params.id
    services.eliminarJugador(id)
        .then(() => res.send(views.eliminacionExito(id)))
}