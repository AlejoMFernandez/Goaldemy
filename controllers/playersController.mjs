import { teams, VALID_SECTIONS } from '../db/mongo.mjs';
import { ObjectId } from 'mongodb';

const ALLOWED_EDIT_FIELDS = new Set([
	// datos comunes del JSON
	'name', 'shirtNumber', 'ccode', 'cname',
	'positionId', 'positionIds', 'positionIdsDesc',
	'height', 'age', 'dateOfBirth', 'transferValue',
	'injured', 'rcards', 'ycards', 'excludeFromRanking',
	// role es un subobjeto. Permitimos setear todo el role si llega bien formado
	'role'
]);

function toInt(v) { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }

export async function listPlayers(req, res) {
	// filtros: section y ccode (dos campos como pide la consigna), opcionales teamId también
	const section = req.query.section?.toLowerCase();
	const ccode = req.query.ccode?.toUpperCase();
	const teamId = toInt(req.query.teamId);

	const match = { };
	if (section && VALID_SECTIONS.includes(section)) match['squad.title'] = section;
	else match['squad.title'] = { $in: ['keepers','defenders','midfielders','attackers'] };
	if (teamId !== null) match.id = teamId;

	const pipeline = [
		{ $match: { ...(teamId !== null ? { id: teamId } : {}) } },
		{ $unwind: '$squad' },
		{ $match: match },
		{ $unwind: '$squad.members' },
		...(ccode ? [{ $match: { 'squad.members.ccode': ccode } }] : []),
		{
			$project: {
				_id: 0,
				teamId: '$id',
				teamName: '$name',
				teamLogo: '$logo',
				section: '$squad.title',
				player: '$squad.members'
			}
		}
	];

	const data = await teams().aggregate(pipeline).toArray();
	res.json(data);
}

export async function createPlayer(req, res) {
	const teamId = toInt(req.params.teamId);
	if (teamId === null) return res.status(400).json({ error: 'Invalid teamId' });

	let { section, player } = req.body;
	section = String(section || '').toLowerCase();
	if (!VALID_SECTIONS.includes(section) || section === 'coach') {
		return res.status(400).json({ error: 'Section must be one of keepers/defenders/midfielders/attackers' });
	}
	if (!player || typeof player !== 'object') return res.status(400).json({ error: 'player object required' });

	// Generar id si no viene
	if (player.id == null) player.id = Date.now();

	// Sanitizar: solo campos conocidos o se guarda tal cual? Permitimos tal cual, pero normalmente conviene filtrar
	// Aquí aceptamos tal cual para no romper el esquema importado.

	const r = await teams().updateOne(
		{ id: teamId, 'squad.title': section },
		{ $push: { 'squad.$.members': player } }
	);
	if (!r.matchedCount) return res.status(404).json({ error: 'Team or section not found' });
	return res.status(201).json({ ok: true, teamId, section, playerId: player.id });
}

export async function updatePlayer(req, res) {
	const teamId = toInt(req.params.teamId);
	const playerId = toInt(req.params.playerId);
	if (teamId === null || playerId === null) return res.status(400).json({ error: 'Invalid ids' });

	const { section: newSectionRaw, ...rest } = req.body || {};
	const newSection = newSectionRaw ? String(newSectionRaw).toLowerCase() : null;
	if (newSection && (!VALID_SECTIONS.includes(newSection) || newSection === 'coach')) {
		return res.status(400).json({ error: 'Invalid target section' });
	}

	// Construir $set solo con campos permitidos
	const playerSet = {};
	for (const [k, v] of Object.entries(rest)) {
		if (ALLOWED_EDIT_FIELDS.has(k)) playerSet[`squad.$[s].members.$[m].${k}`] = v;
	}
	const arrayFilters = [
		{ 's.title': { $in: ['keepers','defenders','midfielders','attackers'] } },
		{ 'm.id': playerId }
	];

	// Si hay cambio de sección, hacemos pull + push atómico (dos operaciones)
	if (newSection) {
		// 1) eliminar de cualquier sección
		const pull = await teams().updateOne(
			{ id: teamId },
			{ $pull: { 'squad.$[s].members': { id: playerId } } },
			{ arrayFilters: [{ 's.title': { $in: ['keepers','defenders','midfielders','attackers'] } }] }
		);
		if (!pull.matchedCount) return res.status(404).json({ error: 'Team not found' });

		// 2) preparar documento jugador actualizado (si hay campos a editar)
		let playerDoc = null;
		if (Object.keys(playerSet).length > 0) {
			// Si edita campos, necesitamos cargar el jugador actual (ya lo quitamos)
			const t = await teams().findOne({ id: teamId });
			// Como lo removimos, no podemos leerlo ahora. Pedimos que envíe el objeto completo si cambia de sección + edita.
			// Para mantener simple: si se cambia de sección, pedimos el objeto player completo en 'player'.
		}

		// preferible: si viene req.body.player completo, lo usamos; sino hacemos un $push con set por defecto
		const playerFull = req.body.player && typeof req.body.player === 'object'
			? { ...req.body.player, id: playerId }
			: { id: playerId, ...rest };

		const push = await teams().updateOne(
			{ id: teamId, 'squad.title': newSection },
			{ $push: { 'squad.$.members': playerFull } }
		);
		if (!push.matchedCount) return res.status(404).json({ error: 'Target section not found' });
		return res.json({ ok: true, movedTo: newSection });
	}

	// Edición in-place sin cambiar de sección
	if (Object.keys(playerSet).length === 0) {
		return res.status(400).json({ error: 'No editable fields provided' });
	}

	const r = await teams().updateOne(
		{ id: teamId },
		{ $set: playerSet },
		{ arrayFilters }
	);
	if (!r.matchedCount) return res.status(404).json({ error: 'Team or player not found' });
	return res.json({ ok: true, modifiedCount: r.modifiedCount });
}

export async function deletePlayer(req, res) {
	const teamId = toInt(req.params.teamId);
	const playerId = toInt(req.params.playerId);
	if (teamId === null || playerId === null) return res.status(400).json({ error: 'Invalid ids' });

	const r = await teams().updateOne(
		{ id: teamId },
		{ $pull: { 'squad.$[s].members': { id: playerId } } },
		{ arrayFilters: [{ 's.title': { $in: ['keepers','defenders','midfielders','attackers'] } }] }
	);
	if (!r.matchedCount) return res.status(404).json({ error: 'Team not found' });
	return res.json({ ok: true, modifiedCount: r.modifiedCount });
}

export async function getPlayerForEdit(teamId, playerId) {
	// Utilitario para vistas (editar)
	const t = await teams().findOne(
		{ id: teamId },
		{ projection: { name: 1, logo: 1, id: 1, squad: 1 } }
	);
	if (!t) return null;
	for (const s of t.squad || []) {
		for (const m of (s.members || [])) {
			if (m.id === playerId) return { team: { id: t.id, name: t.name }, section: s.title, player: m };
		}
	}
	return null;
}
