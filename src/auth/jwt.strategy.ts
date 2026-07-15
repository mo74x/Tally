/* eslint-disable @typescript-eslint/require-await */
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';

export interface JwtPayload {
  sub: string;
  employerId: string;
  role: 'admin' | 'employee';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // Tell Passport to look for the token in the Authorization: Bearer <token> header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Must match the secret defined in AuthModule
      secretOrKey: 'tally-super-secret-key-2026',
    });
  }
  async validate(payload: JwtPayload) {
    if (!payload.employerId) {
      throw new UnauthorizedException('Token missing employer context');
    }

    return {
      userId: payload.sub,
      employerId: payload.employerId,
      role: payload.role,
    };
  }
}
