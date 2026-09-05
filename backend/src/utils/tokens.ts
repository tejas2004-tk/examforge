import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface JwtPayload {
  sub: string;
  role: string;
  type: 'access' | 'refresh';
  jti: string;
}

export const signAccessToken = (userId: string, role: string): string =>
  jwt.sign(
    { sub: userId, role, type: 'access', jti: crypto.randomUUID() },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN } as SignOptions,
  );

export const signRefreshToken = (userId: string, role: string): string =>
  jwt.sign(
    { sub: userId, role, type: 'refresh', jti: crypto.randomUUID() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as SignOptions,
  );

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

export const verifyRefreshToken = (token: string): JwtPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
