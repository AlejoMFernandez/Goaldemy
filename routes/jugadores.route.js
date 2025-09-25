import express from "express"
import * as controller from "../controllers/jugadores.controller.js"

const router = express.Router()

router.get( "/", controller.getJugadores)
router.get( "/:id", controller.getJugadorById)
router.get("/nuevo", controller.formularioNuevoJugador)
router.post("/nuevo", controller.guardarJugador)
router.get("/modificar/:id", controller.formularioModificarJugador)
router.post("/modificar/:id", controller.editarJugador)
router.get( "/eliminar/:id", controller.formularioEliminarJugador )
router.post( "/eliminar/:id", controller.eliminarJugador )

export default router