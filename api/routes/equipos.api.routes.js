import { Router } from "express";
import * as controllers from "../controllers/controller.api.equipos.js"

const route = Router()

route.get("/", controllers.getEquipos)
route.get("/:id", controllers.getEquipoById)
route.post("/", controllers.nuevoEquipo)
route.delete("/:id", controllers.eliminarEquipo)
route.patch("/:id", controllers.editarEquipo)                            
route.put("/:id", controllers.reemplazarEquipo)
route.post("/:idEquipo/zapatilla", controllers.nuevaZapatilla)

export default route