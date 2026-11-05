import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  stellar_address: string;
  role?: string;
  is_client?: boolean;
  is_freelancer?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined = req.cookies?.token || req.cookies?.trustpay_session;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please authenticate via Stellar SEP-0010 Web Auth.',
      });
    }

    const decoded = jwt.verify(token, env.jwtSecret) as any;
    req.user = {
      stellar_address: decoded.sub || decoded.stellar_address,
      role: decoded.role,
      is_client: decoded.is_client,
      is_freelancer: decoded.is_freelancer,
    };

    next();
  } catch (err: any) {
    logger.warn(`Authentication failed: ${err.message}`);
    return res.status(401).json({
      error: 'Invalid or expired authentication session. Please sign in again.',
      details: err.message,
    });
  }
};

export const optionalAuthenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let token: string | undefined = req.cookies?.token || req.cookies?.trustpay_session;

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (token) {
      const decoded = jwt.verify(token, env.jwtSecret) as any;
      req.user = {
        stellar_address: decoded.sub || decoded.stellar_address,
        role: decoded.role,
        is_client: decoded.is_client,
        is_freelancer: decoded.is_freelancer,
      };
    }
  } catch (err: any) {
    // Graceful fallback for optional auth
    logger.debug(`Optional auth skipped: ${err.message}`);
  }
  next();
};
