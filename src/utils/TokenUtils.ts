import jwt from 'jsonwebtoken';
import { Timeouts } from '@constants/timeouts';
import { JwtPayload } from '@app-types/domain';

/**
 * Mints/decodes JWTs independently of the backend, mirroring middleware/auth.js exactly:
 * `jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })`, fallback secret `'your_jwt_secret_key'`
 * if `JWT_SECRET` is unset. Backs the Session & Security feature files (expired/tampered/wrong-secret
 * token scenarios) without needing the backend to expose any test-only signing endpoint.
 */
export class TokenUtils {
  /** The secret the running backend-under-test actually signs with (see middleware/auth.js:3). */
  static get activeSecret(): string {
    return process.env.JWT_SECRET ?? 'your_jwt_secret_key';
  }

  static decode(token: string): JwtPayload {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded === 'string') {
      throw new Error('TokenUtils.decode: token payload could not be decoded');
    }
    return decoded as JwtPayload;
  }

  /** Shared building block for the three token variants below — only the secret/expiry vary. */
  private static buildToken(userId: string, secret: string, expiresInSeconds: number): string {
    return jwt.sign({ userId }, secret, { expiresIn: expiresInSeconds });
  }

  /** A well-formed, currently-valid token signed with the backend's own secret (24h expiry). */
  static buildValidToken(userId: string): string {
    return TokenUtils.buildToken(userId, TokenUtils.activeSecret, Timeouts.TOKEN_EXPIRY_HOURS * 3600);
  }

  /** Signed with the correct secret but an `exp` already in the past. */
  static buildExpiredToken(userId: string): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { userId, iat: nowSeconds - 3600, exp: nowSeconds - 60 },
      TokenUtils.activeSecret,
    );
  }

  /** Well-formed and unexpired, but signed with a secret the backend does not use. */
  static buildTokenSignedWithWrongSecret(userId: string): string {
    return TokenUtils.buildToken(userId, 'a-completely-different-secret-the-server-never-uses', Timeouts.TOKEN_EXPIRY_HOURS * 3600);
  }

  /**
   * Takes a genuinely-issued token, decodes and mutates its payload, then re-encodes the
   * header/payload without re-signing — the original signature no longer matches, so
   * `jwt.verify` on the server must reject it (BR/SEC "tampered payload, unchanged signature").
   */
  static tamperPayload(validToken: string, mutate: (payload: JwtPayload) => JwtPayload): string {
    const [headerSegment, payloadSegment, signatureSegment] = validToken.split('.');
    if (!headerSegment || !payloadSegment || !signatureSegment) {
      throw new Error('TokenUtils.tamperPayload: not a well-formed JWT');
    }
    const originalPayload = JSON.parse(
      Buffer.from(payloadSegment, 'base64url').toString('utf-8'),
    ) as JwtPayload;
    const tamperedPayload = mutate(originalPayload);
    const tamperedSegment = Buffer.from(JSON.stringify(tamperedPayload), 'utf-8').toString(
      'base64url',
    );
    return `${headerSegment}.${tamperedSegment}.${signatureSegment}`;
  }

  static buildMalformedToken(): string {
    return 'this.is-not.a-valid-jwt';
  }

  /** `Authorization` header value; pass `prefix: ''` to omit the "Bearer " scheme entirely. */
  static toAuthHeaderValue(token: string, prefix: 'Bearer' | '' = 'Bearer'): string {
    return prefix ? `${prefix} ${token}` : token;
  }
}
