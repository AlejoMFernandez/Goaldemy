import { Router } from 'express';
import { listPlayers, createPlayer, updatePlayer, deletePlayer } from '../controllers/playersController.mjs';

const router = Router();

// GET /api/players?section=defenders&ccode=BRA&teamId=8634
router.get('/players', listPlayers);

// POST /api/teams/:teamId/players
router.post('/teams/:teamId/players', createPlayer);

// PUT /api/teams/:teamId/players/:playerId
router.put('/teams/:teamId/players/:playerId', updatePlayer);

// DELETE /api/teams/:teamId/players/:playerId
router.delete('/teams/:teamId/players/:playerId', deletePlayer);

export default router;
