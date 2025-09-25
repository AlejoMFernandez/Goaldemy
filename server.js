import express from "express"
import JugadoresRouter from "./routes/jugadores.route.js"
import JugadorApiRouter from "./api/routes/jugadores.api.routes.js"
import EquiposRouter from "./routes/equipos.route.js"
import EquiposApiRouter from "./api/routes/equipos.api.routes.js"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()

app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/styles/css', express.static( join(__dirname, 'styles/css') ) )
app.use( "/img", express.static( join(__dirname, "img") ) )

app.use("/jugadores", JugadoresRouter)
app.use("/api/jugadores", JugadorApiRouter)
app.use("/equipos", EquiposRouter)
app.use("/api/equipos", EquiposApiRouter)

app.listen(2025, () => {
    console.log("Funcionando")
})