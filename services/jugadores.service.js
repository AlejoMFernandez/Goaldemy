import { MongoClient, ObjectId } from "mongodb"

// Cambia la URI de conexión a la de tu base de datos real
const client = new MongoClient("mongodb+srv://admin:admin123@goaldemy.jaqeums.mongodb.net/")
const db = client.db("data")

// Función utilitaria para obtener la URL de la imagen del jugador
function getPlayerImageUrl(playerId) {
  return `https://images.fotmob.com/image_resources/playerimages/${playerId}.png`
}

// Traer todos los jugadores, con filtro opcional por club
export async function getJugadores(filter = {}) {
  const filterMongo = {}

  // Filtrar por club (por ejemplo, name o shortName)
  if (filter.club != undefined) {
    // Puedes ajustar el campo según cómo se llame en tu colección (name, shortName, id, etc.)
    filterMongo["name"] = { $eq: filter.club }
    // Si quieres filtrar por shortName, usa: filterMongo["shortName"] = { $eq: filter.club }
  }

  await client.connect()
  const clubes = await db.collection("teamsANDplayers").find(filterMongo).toArray()

  // Array para todos los jugadores
  const jugadores = []

  clubes.forEach(club => {
    if (Array.isArray(club.squad)) {
      club.squad.forEach(posicion => {
        if (Array.isArray(posicion.members)) {
          posicion.members.forEach(member => {
            jugadores.push({
              ...member,
              club: club.name,
              clubId: club.id,
              clubShortName: club.shortName,
              clubLogo: club.logo,
              posicion: posicion.title,
              imgUrl: getPlayerImageUrl(member.id),
              imgFallbackUrl: club.logo
            })
          })
        }
      })
    }
  })

  return jugadores
}

// Traer jugador por ID interno (no ObjectId de MongoDB)
export async function getJugadorById(jugadorId) {
  await client.connect()
  const clubes = await db.collection("teamsANDplayers").find({}).toArray()
  for (const club of clubes) {
    if (Array.isArray(club.squad)) {
      for (const posicion of club.squad) {
        if (Array.isArray(posicion.members)) {
          for (const member of posicion.members) {
            if (String(member.id) === String(jugadorId)) {
              return {
                ...member,
                club: club.name,
                clubId: club.id,
                clubShortName: club.shortName,
                clubLogo: club.logo,
                posicion: posicion.title,
                imgUrl: getPlayerImageUrl(member.id),
                imgFallbackUrl: club.logo
              }
            }
          }
        }
      }
    }
  }
  return null
}

// Guardar nuevo jugador
export async function guardarJugador(jugador) {
  await client.connect()
  return db.collection("teamsANDplayers").insertOne(jugador)
}

// Reemplazar jugador por ID
export function reemplazarJugador(id, jugador) {
  return db.collection("teamsANDplayers").replaceOne({ _id: new ObjectId(id) }, jugador)
}

// Eliminar jugador (soft delete)
export function eliminarJugador(id) {
  return db.collection("teamsANDplayers").updateOne({ _id: new ObjectId(id) }, {
    $set: {
      eliminado: true
    }
  })
}

// Editar jugador
export function editarJugador(id, jugador) {
  return db.collection("teamsANDplayers").updateOne({ _id: new ObjectId(id) }, { $set: jugador })
}