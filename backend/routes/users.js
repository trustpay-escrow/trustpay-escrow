import { Router } from 'express';
import { supabase } from '../lib/supabase.js';

const router = Router();

// Sign up or login (upsert user by stellar_address)
router.post('/connect', async (req, res) => {
  try {
    const { stellar_address, role } = req.body;

    if (!stellar_address) {
      return res.status(400).json({ error: 'Stellar address is required' });
    }
    if (!role || !['client', 'freelancer'].includes(role)) {
      return res.status(400).json({ error: 'Valid role (client/freelancer) is required' });
    }

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('stellar_address', stellar_address)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      console.error('Error fetching user:', fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      // User exists, just log them in
      return res.status(200).json({ message: 'User logged in successfully', user: existingUser });
    }

    // User does not exist, create a new record
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{ stellar_address, role }])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    console.error('Unexpected error in /users/connect:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
