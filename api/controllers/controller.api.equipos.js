import * as service from "../../services/equipos.service.js"
import * as serviceZapatillas from "../../services/equipos.service.js"
export function getEquipos(req, res){
    const filtros = req.query
    service.getequipos(filtros)
        .then( equipos => equipos.length > 0 
                        ? res.status(200).json(equipos)
                        : res.status(500).json({})
                    )
}

export function getEquipoById(req, res){
    const id = req.params.id
    service.getequiposById(id)
        .then( equipo => res.status(200).json(equipo) )
}

export function nuevoEquipo(req, res){
    const equipo = {
        "name": req.body.name,
        "species": req.body.species,
        "gender": req.body.gender,
        "house": req.body.house,
        "wizard": req.body.wizard,
        "ancestry": req.body.ancestry,
        "eyeColour": req.body.eyeColour,
        "hairColour": req.body.hairColour
    }
    service.guardarEquipo( equipo )
        .then( (equipoNuevo) => res.status(201).json(equipoNuevo) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el equipo"} ) )
}

export function eliminarEquipo(req, res){
    const id = req.params.id
    service.Eliminarequipo(id)
        .then( (id) => res.status(202).json({ message: `equipo eliminado correctamente id: ${id}` }) )
        .catch( (err) => res.status(500).json( {message: "No se elimino el equipo"} ) )
}

export function editarEquipo(req, res){
    const id = req.params.id
    service.editarequipo(id, req.body)        
        .then( (equipoEditado) => res.status(202).json(equipoEditado) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el equipo"} ) )
}

export function reemplazarEquipo(req, res){
    const id = req.params.id
    const equipo = {
        "name": req.query.name,
        "species": req.query.species,
        "gender": req.query.gender,
        "house": req.query.house,
        "wizard": req.query.wizard,
        "ancestry": req.query.ancestry,
        "eyeColour": req.query.eyeColour,
        "hairColour": req.query.hairColour
    }
    service.reemplazarEquipo(id, equipo)        
        .then( (equipoEditado) => res.status(202).json(equipoEditado) )
        .catch( (err) => res.status(500).json( {message: "No se guardo el equipo"} ) )
}

export function nuevaZapatilla(req, res){
    const id = req.params.idequipo
    const zapatilla = {
        marca: req.body.marca,
        modelo: req.body.modelo,
        precio: req.body.precio,
        duenio: id
    }
    serviceZapatillas.guardarProducto(zapatilla)
        .then( (nuevaZapatilla) => service.guardarDuenio(id, nuevaZapatilla, zapatilla) )
        .then( (  ) => res.status(201).json({message: "Zapatilla creada!"}) )
}