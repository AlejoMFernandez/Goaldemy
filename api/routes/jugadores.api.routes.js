import { Router } from "express";
import * as controllers from "../controllers/controller.api.jugadores.js"

const route = Router()
//query string mongodb+srv://admin:admin@dwn4ap.syxmi5s.mongodb.net/
route.get("/", controllers.getJugadores)
route.get("/:id", controllers.getJugadorById)
route.post("/", controllers.nuevoJugador)
route.delete("/:id", controllers.eliminarJugador)
route.patch("/:id", controllers.editarJugador)                             //  edita solo lo necesario
route.put("/:id", controllers.reemplazarJugador)                           //  Reemplaza

export default route