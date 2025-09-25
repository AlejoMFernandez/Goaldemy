import { Router } from 'express';
import { listTeams, createTeam, listPlayersOfTeam } from '../controllers/teamsController.mjs';

const router = Router();

// GET /api/clients  -> teams
router.get('/clients', listTeams);

// POST /api/clients -> create team
router.post('/clients', createTeam);

// GET /api/clients/:teamId/projects -> players of a team
router.get('/clients/:teamId/projects', listPlayersOfTeam);

export default router;
