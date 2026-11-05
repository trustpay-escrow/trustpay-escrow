import { Request, Response } from 'express';
import { WebAuth, StrKey } from '@stellar/stellar-sdk';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { serverKeypair } from '../../config/stellar.js';
import { supabase } from '../../config/supabase.js';
import { logger } from '../../shared/utils/logger.js';
import { AuthenticatedRequest } from '../../shared/middleware/auth.js';

/**
 * 1. GET /api/auth/challenge?account=G...
 * Generates an unsubmitted SEP-0010 challenge transaction signed by the server keypair.
 */
export const getChallenge = async (req: Request, res: Response) => {
  try {
    const account = (req.query.account || req.query.address) as string;

    if (!account) {
      return res.status(400).json({ error: 'Query parameter "account" is required' });
    }

    if (!StrKey.isValidEd25519PublicKey(account)) {
      return res.status(400).json({
        error: 'Invalid Stellar public key format. Must be a 56-character Ed25519 key starting with G.',
      });
    }

    const homeDomain = env.stellarHomeDomain;
    const networkPassphrase = env.stellarNetworkPassphrase;
    const timeout = 300; // 5-minute timebound according to SEP-0010

    const challengeXdr = WebAuth.buildChallengeTx(
      serverKeypair,
      account,
      homeDomain,
      timeout,
      networkPassphrase,
      homeDomain
    );

    logger.info(`Generated SEP-0010 challenge for client ${account}`);

    return res.status(200).json({
      transaction: challengeXdr,
      network: networkPassphrase.includes('Test') ? 'TESTNET' : 'PUBLIC',
      server_public_key: serverKeypair.publicKey(),
      expires_in: timeout,
    });
  } catch (err: any) {
    logger.error(`Error generating SEP-0010 challenge: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Failed to generate authentication challenge' });
  }
};

/**
 * 2. POST /api/auth/verify
 * Cryptographically verifies the Ed25519 signature on the challenge transaction XDR and issues a secure JWT cookie.
 */
export const verifyChallenge = async (req: Request, res: Response) => {
  try {
    const { transaction, email } = req.body;

    if (!transaction) {
      return res.status(400).json({ error: 'Signed transaction XDR is required in "transaction" field' });
    }

    const homeDomain = env.stellarHomeDomain;
    const networkPassphrase = env.stellarNetworkPassphrase;

    let clientAccount: string;
    try {
      const readResult = WebAuth.readChallengeTx(
        transaction,
        serverKeypair.publicKey(),
        networkPassphrase,
        homeDomain,
        homeDomain
      );
      clientAccount = readResult.clientAccountID;
    } catch (parseErr: any) {
      logger.warn(`SEP-0010 challenge parsing error: ${parseErr.message}`);
      return res.status(400).json({
        error: 'Invalid authentication challenge transaction',
        details: parseErr.message,
      });
    }

    // Verify client signature
    let validSigners: string[];
    try {
      validSigners = WebAuth.verifyChallengeTxSigners(
        transaction,
        serverKeypair.publicKey(),
        networkPassphrase,
        [clientAccount],
        homeDomain,
        homeDomain
      );
    } catch (sigErr: any) {
      logger.warn(`SEP-0010 signature verification failed for client ${clientAccount}: ${sigErr.message}`);
      return res.status(401).json({
        error: 'Signature verification failed. The transaction was not signed by the specified Stellar account.',
        details: sigErr.message,
      });
    }

    if (!validSigners || validSigners.length === 0 || !validSigners.includes(clientAccount)) {
      logger.warn(`SEP-0010 signature verification failed for client ${clientAccount}`);
      return res.status(401).json({
        error: 'Signature verification failed. The transaction was not signed by the specified Stellar account.',
      });
    }

    logger.info(`Cryptographic signature verified successfully for ${clientAccount}`);

    // Lookup user in Supabase
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('stellar_address', clientAccount)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      logger.error(`Error querying user: ${fetchError.message}`);
      return res.status(500).json({ error: 'Database query error during verification' });
    }

    if (existingUser) {
      const token = jwt.sign(
        {
          sub: clientAccount,
          role: existingUser.role || 'user',
          is_client: existingUser.is_client ?? true,
          is_freelancer: existingUser.is_freelancer ?? true,
        },
        env.jwtSecret,
        { expiresIn: (env.jwtExpiresIn || '7d') as any }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: env.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
      });

      return res.status(200).json({
        message: 'Authenticated successfully via Stellar SEP-0010',
        token,
        user: {
          ...existingUser,
          is_client: existingUser.is_client ?? true,
          is_freelancer: existingUser.is_freelancer ?? true,
        },
      });
    }

    // New user registration
    if (!email) {
      return res.status(403).json({
        requiresRegistration: true,
        verified_address: clientAccount,
        message: 'Signature verified! Please provide an email address to complete registration.',
      });
    }

    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          stellar_address: clientAccount,
          role: 'user',
          email,
          is_client: true,
          is_freelancer: true,
        },
      ])
      .select()
      .single();

    let createdUser = newUser;

    if (insertError) {
      // Fallback for older schemas with client/freelancer role enum constraint
      const { data: fallbackUser, error: fallbackError } = await supabase
        .from('users')
        .insert([{ stellar_address: clientAccount, role: 'client', email }])
        .select()
        .single();

      if (fallbackError) {
        logger.error(`Error creating new user: ${fallbackError.message}`);
        return res.status(500).json({ error: 'Failed to create user record' });
      }
      createdUser = fallbackUser;
    }

    const token = jwt.sign(
      {
        sub: clientAccount,
        role: createdUser.role || 'user',
        is_client: true,
        is_freelancer: true,
      },
      env.jwtSecret,
      { expiresIn: (env.jwtExpiresIn || '7d') as any }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: env.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return res.status(201).json({
      message: 'User registered and authenticated successfully',
      token,
      user: { ...createdUser, is_client: true, is_freelancer: true },
    });
  } catch (err: any) {
    logger.error(`Unexpected error in verifyChallenge: ${err.message}`, { stack: err.stack });
    return res.status(500).json({ error: 'Internal server error during authentication verification' });
  }
};

/**
 * 3. GET /api/auth/me
 * Retrieves current authenticated user session.
 */
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.stellar_address) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('stellar_address', req.user.stellar_address)
      .single();

    if (error || !user) {
      return res.status(200).json({
        user: {
          stellar_address: req.user.stellar_address,
          role: req.user.role || 'user',
          is_client: req.user.is_client ?? true,
          is_freelancer: req.user.is_freelancer ?? true,
        },
      });
    }

    return res.status(200).json({
      user: {
        ...user,
        is_client: user.is_client ?? true,
        is_freelancer: user.is_freelancer ?? true,
      },
    });
  } catch (err: any) {
    logger.error(`Error in getMe: ${err.message}`);
    return res.status(500).json({ error: 'Failed to retrieve session profile' });
  }
};

/**
 * 4. POST /api/auth/logout
 * Clears the session cookie.
 */
export const logout = (req: Request, res: Response) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
  res.clearCookie('trustpay_session', {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return res.status(200).json({ message: 'Logged out successfully' });
};
