import { Response } from 'express';
import { supabase } from '../config/supabase.js';
import { UserConnectRequest } from '../types/index.js';
import { logger } from '../utils/logger.js';

export const connectWallet = async (req: UserConnectRequest, res: Response) => {
  try {
    const { stellar_address, role } = req.body;

    if (!stellar_address) {
      logger.warn('Connection attempt failed: Missing stellar_address');
      return res.status(400).json({ error: 'Stellar address is required' });
    }
    if (!role || !['client', 'freelancer'].includes(role)) {
      logger.warn(`Connection attempt failed: Invalid role provided (${role})`);
      return res.status(400).json({ error: 'Valid role (client/freelancer) is required' });
    }

    // Check if user already exists
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
      logger.info(`User logged in: ${stellar_address} as ${role}`);
      return res.status(200).json({ message: 'User logged in successfully', user: existingUser });
    }

    // User does not exist, require an email to proceed
    const { email } = req.body;
    if (!email) {
      return res.status(403).json({ requiresRegistration: true, message: 'Please provide an email to register.' });
    }

    // Email provided, create a new record
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ stellar_address, role, email }])
      .select()
      .single();

    if (insertError) {
      logger.error(`Error creating user: ${insertError.message}`, { error: insertError });
      return res.status(500).json({ error: 'Failed to create user' });
    }

    logger.info(`New user registered: ${stellar_address} as ${role}`);
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err: any) {
    logger.error(`Unexpected error in connectWallet: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
  }
};
