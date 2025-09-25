import { MongoClient, ObjectId } from "mongodb"

const client = new MongoClient("mongodb+srv://admin:admin123@goaldemy.jaqeums.mongodb.net")
const db = client.db("data")

export async function getEquipos(filter = {}) {
    await client.connect()
    return db.collection("teamsANDplayers").find(filter).toArray()
}
