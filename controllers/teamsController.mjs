import { teams, VALID_SECTIONS } from '../db/mongo.mjs';

function toInt(v) { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }

export async function listTeams(req, res) {
	const data = await teams().find({}, { projection: { _id: 0, id: 1, name: 1, shortName: 1, logo: 1 } }).toArray();
	res.json(data);
}

export async function createTeam(req, res) {
	const { id, name, shortName, logo } = req.body || {};
	if (!id || !name) return res.status(400).json({ error: 'id and name are required' });

	const squad = [
		{ title: 'coach', members: [] },
		{ title: 'keepers', members: [] },
		{ title: 'defenders', members: [] },
		{ title: 'midfielders', members: [] },
		{ title: 'attackers', members: [] }
	];

	const doc = { id: parseInt(id, 10), name, shortName: shortName || name, logo: logo || '', squad };
	try {
		await teams().insertOne(doc);
		return res.status(201).json({ ok: true });
	} catch (e) {
		if (e.code === 11000) return res.status(409).json({ error: 'Team id already exists' });
		throw e;
	}
}

export async function listPlayersOfTeam(req, res) {
	const teamId = toInt(req.params.teamId);
	if (teamId === null) return res.status(400).json({ error: 'Invalid teamId' });

	const pipeline = [
		{ $match: { id: teamId } },
		{ $unwind: '$squad' },
		{ $match: { 'squad.title': { $in: ['keepers','defenders','midfielders','attackers'] } } },
		{ $unwind: '$squad.members' },
		{
			$project: {
				_id: 0,
				teamId: '$id',
				teamName: '$name',
				section: '$squad.title',
				player: '$squad.members'
			}
		}
	];
	const data = await teams().aggregate(pipeline).toArray();
	res.json(data);
}

export async function listTeamsForView() {
	return teams().find({}, { projection: { _id: 0, id: 1, name: 1, shortName: 1, logo: 1 } }).toArray();
}
