import { Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabase } from '../../config/supabase.js';
import { env } from '../../config/env.js';
import { UserConnectRequest } from '../../shared/types/index.js';
import { logger } from '../../shared/utils/logger.js';

export const connectWallet = async (req: UserConnectRequest, res: Response) => {
  try {
    const { stellar_address } = req.body;

    if (!stellar_address) {
      logger.warn('Connection attempt failed: Missing stellar_address');
      return res.status(400).json({ error: 'Stellar address is required' });
    }

    // Cryptographic Session Verification
    let token = req.cookies?.token || req.cookies?.trustpay_session;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        error: 'Unauthenticated wallet spoofing blocked. Please authenticate via SEP-0010 at /api/auth/challenge and /api/auth/verify.',
        requires_sep10: true,
      });
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret) as any;
      const tokenAddress = decoded.sub || decoded.stellar_address;
      if (tokenAddress !== stellar_address) {
        return res.status(403).json({
          error: 'Security alert: Connected address does not match signed cryptographic session.',
        });
      }
    } catch (jwtErr: any) {
      return res.status(401).json({
        error: 'Invalid or expired session token. Please re-authenticate via SEP-0010.',
      });
    }

    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('stellar_address', stellar_address)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error(`Error fetching user: ${fetchError.message}`, { error: fetchError });
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      logger.info(`Authenticated user accessed wallet endpoint: ${stellar_address}`);
      return res.status(200).json({
        message: 'User logged in successfully',
        user: {
          ...existingUser,
          is_client: existingUser.is_client ?? true,
          is_freelancer: existingUser.is_freelancer ?? true,
        },
      });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(403).json({ requiresRegistration: true, message: 'Please provide an email to register.' });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          stellar_address,
          role: 'user',
          email,
          is_client: true,
          is_freelancer: true,
        },
      ])
      .select()
      .single();

    if (insertError) {
      const { data: fallbackUser, error: fallbackError } = await supabase
        .from('users')
        .insert([{ stellar_address, role: 'client', email }])
        .select()
        .single();

      if (fallbackError) {
        logger.error(`Error creating user: ${fallbackError.message}`, { error: fallbackError });
        return res.status(500).json({ error: 'Failed to create user' });
      }

      return res.status(201).json({
        message: 'User registered successfully',
        user: { ...fallbackUser, is_client: true, is_freelancer: true },
      });
    }

    logger.info(`New multi-capability user registered: ${stellar_address}`);
    return res.status(201).json({
      message: 'User registered successfully',
      user: { ...newUser, is_client: true, is_freelancer: true },
    });
  } catch (err: any) {
    logger.error(`Unexpected error in connectWallet: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
