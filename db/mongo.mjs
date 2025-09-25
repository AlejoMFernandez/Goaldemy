import { MongoClient } from 'mongodb';

const URI = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@goaldemy.jaqeums.mongodb.net';
const DB_NAME = process.env.DB_NAME || 'data';
const TEAMS_COLLECTION = process.env.TEAMS_COLLECTION || 'teamsANDplayers';

let client;
let db;

export async function connectToDb() {
	if (!client) {
		client = new MongoClient(URI, { ignoreUndefined: true });
		await client.connect();
		db = client.db(DB_NAME);
	}
	return db;
}

export function getDb() {
	if (!db) throw new Error('DB not initialized. Call connectToDb() first.');
	return db;
}

export function teams() {
	return getDb().collection(TEAMS_COLLECTION);
}

export const VALID_SECTIONS = ['coach', 'keepers', 'defenders', 'midfielders', 'attackers'];