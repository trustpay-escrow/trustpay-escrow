import { Router } from 'express';
import { connectWallet } from '../controllers/userController.js';

const router = Router();

// Sign up or login (upsert user by stellar_address)
router.post('/connect', connectWallet);

export default router;
