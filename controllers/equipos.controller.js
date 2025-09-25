import { createPage } from "../pages/utils.js"
import * as services from "../services/equipos.service.js"
import * as views from "../views/equipos.view.js"

export function getEquipos(req, res){
    const filter = req.query
    services.getEquipos(filter)
        .then( (equipos) => res.send( views.crearListadoEquipos(equipos) ) )
} 

// export function getProductosById(req, res){
//     const id = req.params.id
//     services.getProductosById(id)
//         .then( producto => res.send( views.crearDetalleProducto(producto) ) )
// }
