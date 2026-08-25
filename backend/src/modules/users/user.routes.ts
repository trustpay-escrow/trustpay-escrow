import { Router } from 'express';
import { connectWallet } from './user.controller.js';

const router = Router();

router.post('/connect', connectWallet);

export default router;
