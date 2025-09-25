import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import methodOverride from 'method-override';
import playersApi from './routes/players.mjs';
import teamsApi from './routes/teams.mjs';
import { connectToDb, teams as teamsColl, VALID_SECTIONS } from './db/mongo.mjs';
import { listTeamsForView } from './controllers/teamsController.mjs';
import { getPlayerForEdit } from './controllers/playersController.mjs';
import expressLayouts from 'express-ejs-layouts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3333;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride((req) => (req.body && typeof req.body === 'object' && '_method' in req.body) ? req.body._method : undefined));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use('/public', express.static(path.join(__dirname, 'public')));

// API
app.use('/api', playersApi);
app.use('/api', teamsApi);

// Home
app.get('/', async (req, res) => {
	const teams = await listTeamsForView();
	res.render('index', { teams, sections: VALID_SECTIONS });
});

// Página por sección: /section/keepers
app.get('/section/:slug', async (req, res) => {
	const slug = String(req.params.slug).toLowerCase();
	const valid = ['keepers','defenders','midfielders','attackers','coach'];
	if (!valid.includes(slug)) return res.status(404).send('Section not found');

	const teamId = req.query.teamId ? parseInt(req.query.teamId, 10) : null;

	const pipeline = [
		...(teamId ? [{ $match: { id: teamId } }] : []),
		{ $unwind: '$squad' },
		{ $match: { 'squad.title': slug } },
		{ $unwind: '$squad.members' },
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
	const players = await teamsColl().aggregate(pipeline).toArray();
	const teams = await listTeamsForView();
	res.render('section', { slug, players, teams, sections: VALID_SECTIONS, selectedTeamId: teamId });
});

// Form: crear jugador
app.get('/players/new', async (req, res) => {
	const teams = await listTeamsForView();
	res.render('player-form', {
		mode: 'new',
		teams,
		sections: ['keepers','defenders','midfielders','attackers'],
		selectedTeamId: null,
		selectedSection: 'attackers',
		player: {}
	});
});

// Submit crear jugador (usa API)
app.post('/players', async (req, res) => {
	const { teamId, section, ...player } = req.body;
	try {
		const r = await fetch(`http://localhost:${PORT}/api/teams/${teamId}/players`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ section, player })
		});
		if (!r.ok) throw new Error('API error');
		return res.redirect(`/section/${section}`);
	} catch (e) {
		return res.status(400).send('Error creating player');
	}
});

// Form: editar jugador
app.get('/teams/:teamId/players/:playerId/edit', async (req, res) => {
	const teamId = parseInt(req.params.teamId, 10);
	const playerId = parseInt(req.params.playerId, 10);
	const info = await getPlayerForEdit(teamId, playerId);
	if (!info) return res.status(404).send('Player not found');

	const teams = await listTeamsForView();
	res.render('player-form', {
		mode: 'edit',
		teams,
		sections: ['keepers','defenders','midfielders','attackers'],
		selectedTeamId: info.team.id,
		selectedSection: info.section,
		player: info.player
	});
});

// Submit editar jugador (usa API), permite mover de sección e incluso a otro equipo
app.post('/teams/:teamId/players/:playerId', async (req, res) => {
	const origTeamId = req.params.teamId;
	const playerId = req.params.playerId;
	const { teamId, section, ...rest } = req.body;

	// Si cambió de equipo, borramos del original y creamos en el nuevo (simple)
	if (teamId !== origTeamId) {
		// eliminar del original
		await fetch(`http://localhost:${PORT}/api/teams/${origTeamId}/players/${playerId}`, { method: 'DELETE' });
		// crear en el nuevo con el mismo id
		await fetch(`http://localhost:${PORT}/api/teams/${teamId}/players`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ section, player: { id: parseInt(playerId, 10), ...rest } })
		});
		return res.redirect(`/section/${section}`);
	}

	// Mismo equipo: PUT con posibles cambios de sección
	await fetch(`http://localhost:${PORT}/api/teams/${teamId}/players/${playerId}`, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ section, ...rest, player: { id: parseInt(playerId, 10), ...rest } })
	});
	return res.redirect(`/section/${section}`);
});

// Eliminar (desde UI)
app.post('/teams/:teamId/players/:playerId/delete', async (req, res) => {
	const { section } = req.body;
	await fetch(`http://localhost:${PORT}/api/teams/${req.params.teamId}/players/${req.params.playerId}`, { method: 'DELETE' });
	return res.redirect(`/section/${section || 'attackers'}`);
});

await connectToDb();
app.listen(PORT, () => console.log(`HTTP http://localhost:${PORT}`));
