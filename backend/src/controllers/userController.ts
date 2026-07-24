import { Response } from 'express';
import { supabase } from '../config/supabase.js';
import { UserConnectRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const connectWallet = async (req: UserConnectRequest, res: Response) => {
  try {
    const { stellar_address } = req.body;

    if (!stellar_address) {
      logger.warn('Connection attempt failed: Missing stellar_address');
      return res.status(400).json({ error: 'Stellar address is required' });
    }

    // Check if single user identity already exists for this wallet address
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
      logger.info(`User logged in with wallet: ${stellar_address}`);
      return res.status(200).json({
        message: 'User logged in successfully',
        user: {
          ...existingUser,
          is_client: existingUser.is_client ?? true,
          is_freelancer: existingUser.is_freelancer ?? true,
        }
      });
    }

    // User does not exist, require an email to proceed
    const { email } = req.body;
    if (!email) {
      return res.status(403).json({ requiresRegistration: true, message: 'Please provide an email to register.' });
    }

    // Email provided, create a single multi-capability user record
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        stellar_address,
        role: 'user',
        email,
        is_client: true,
        is_freelancer: true
      }])
      .select()
      .single();

    if (insertError) {
      // If table doesn't have is_client / is_freelancer columns yet, fallback to inserting without them
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
        user: { ...fallbackUser, is_client: true, is_freelancer: true }
      });
    }

    logger.info(`New multi-capability user registered: ${stellar_address}`);
    return res.status(201).json({
      message: 'User registered successfully',
      user: { ...newUser, is_client: true, is_freelancer: true }
    });
  } catch (err: any) {
    logger.error(`Unexpected error in connectWallet: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Internal server error' });
  }
};
