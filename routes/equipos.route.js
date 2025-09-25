import express from "express"
import * as controller from "../controllers/equipos.controller.js"

const router = express.Router()

router.get( "/", controller.getEquipos)
// router.get( "/:id", controller.getPersonajesBy)

export default router