import {
  formatWait,
  isSuffixInRange,
  parseAuthCallback,
  signInCooldownMs,
  validateNewPassword,
  validateSignIn,
} from './auth';

describe('passwords', () => {
  it('asks for 8+ characters, not too repetitive, without the e-mail', () => {
    expect(validateNewPassword('1234567')).toContain('8 caracteres');
    expect(validateNewPassword('aaaaaaaa')).toContain('repetitiva');
    expect(validateNewPassword('raulgardini2026', 'raulgardini@mail.com')).toContain('e-mail');
    expect(validateNewPassword('x'.repeat(40) + 'é'.repeat(20))).toContain('no máximo');
    expect(validateNewPassword('correct horse battery', 'raul@mail.com')).toBeNull();
  });

  it('still lets older accounts with shorter passwords sign in', () => {
    expect(validateSignIn('a@b.co', '123456')).toBeNull();
    expect(validateSignIn('a@b.co', '')).toContain('senha');
    expect(validateSignIn('nope', '12345678')).toContain('e-mail');
  });
});

describe('sign-in throttling', () => {
  it('is free for 3 attempts, then doubles from 30 s up to 15 min', () => {
    expect([0, 1, 2, 3, 4, 5, 10, 30].map(signInCooldownMs)).toEqual([
      0, 0, 0, 30_000, 60_000, 120_000, 900_000, 900_000,
    ]);
  });

  it('tells how long to wait', () => {
    expect(formatWait(30_000)).toContain('30 s');
    expect(formatWait(90_000)).toContain('1 min 30 s');
    expect(formatWait(120_000)).toContain('2 min.');
  });
});

describe('parseAuthCallback', () => {
  it('reads the PKCE code and what the link was for', () => {
    expect(parseAuthCallback('habits://auth/callback?next=reset&code=abc')).toEqual({
      code: 'abc',
      next: 'reset',
      error: null,
    });
    expect(parseAuthCallback('https://app.example/auth/callback?code=x').next).toBe('confirm');
  });

  it('explains an expired link, in the query or in the hash', () => {
    const inHash =
      'habits://auth/callback?next=reset#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallback(inHash)).toMatchObject({ code: null, next: 'reset' });
    expect(parseAuthCallback(inHash).error).toContain('expirou');
    expect(
      parseAuthCallback('https://x/auth/callback?error=access_denied&error_code=otp_expired').error,
    ).toContain('expirou');
  });
});

describe('isSuffixInRange', () => {
  const range = [
    '0018A45C4D1DEF81644B54AB7F969B88D65:3',
    '00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0',
    '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493',
  ].join('\r\n');

  it('finds a leaked password, ignoring padding entries', () => {
    expect(isSuffixInRange(range, '1e4c9b93f3f0682250b6cf8331b7ee68fd8')).toBe(true);
    expect(isSuffixInRange(range, '00D4F6E8FA6EECAD2A3AA415EEC418D38EC')).toBe(false);
    expect(isSuffixInRange(range, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toBe(false);
  });
});
