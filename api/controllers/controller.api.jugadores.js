import * as service from "../../services/jugadores.service.js"

export function getJugadores(req, res){
    const filtros = req.query
    service.getJugadores(filtros)
        .then( jugadores => jugadores.length > 0 
                        ? res.status(200).json(jugadores)
                        : res.status(500).json({})
                    )
}

export function getJugadorById(req, res){
    const id = req.params.id
    service.getJugadoresById(id)
        .then( jugador => res.status(200).json(jugador) )
}

export function nuevoJugador(req, res){
    const jugador = {
        marca: req.body.marca,
        modelo: req.body.modelo,
        precio: req.body.precio
    }
    service.guardarJugador( jugador )
        .then( (jugadorNuevo) => res.status(201).json(jugadorNuevo) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el jugador"} ) )
}

export function eliminarJugador(req, res){
    const id = req.params.id
    service.EliminarJugador(id)
        .then( (id) => res.status(202).json({ message: `jugador eliminado correctamente id: ${id}` }) )
        .catch( (err) => res.status(500).json( {message: "No se elimino el jugador"} ) )
}

export function editarJugador(req, res){
    const id = req.params.id
    service.editarjugador(id, req.body)        
        .then( (jugadorNuevo) => res.status(202).json(jugadorNuevo) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el jugador"} ) )
}

export function reemplazarJugador(req, res){
    const id = req.params.id
    const jugador = {
        marca: req.body.marca,
        modelo: req.body.modelo,
        precio: req.body.precio
    }
    service.reemplazarJugador(id, jugador)        
        .then( (jugadorNuevo) => res.status(202).json(jugadorNuevo) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el jugador"} ) )
}