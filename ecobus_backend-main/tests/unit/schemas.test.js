import {
  loginSchema,
  gpsSchema,
  gpsHistoryQuerySchema,
  busSchema,
  childSchema,
  deviceTokenSchema,
  checkinSchema,
  sosSchema,
} from '../../src/validators/schemas.js';

const UUID = '7f1c0e9a-2b3d-4e5f-90ab-1c2d3e4f5a6b';

describe('loginSchema', () => {
  test('accepts valid email + password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.co', password: 'x' })).not.toThrow();
  });
  test('rejects malformed email', () => {
    expect(() => loginSchema.parse({ email: 'nope', password: 'x' })).toThrow();
  });
  test('rejects empty password', () => {
    expect(() => loginSchema.parse({ email: 'a@b.co', password: '' })).toThrow();
  });
});

describe('gpsSchema', () => {
  const base = { busId: UUID, latitude: 36.8, longitude: 10.1 };
  test('valid minimum payload', () => {
    expect(() => gpsSchema.parse(base)).not.toThrow();
  });
  test('busId must be a uuid', () => {
    expect(() => gpsSchema.parse({ ...base, busId: 'nope' })).toThrow();
  });
  test('latitude bounds enforced', () => {
    expect(() => gpsSchema.parse({ ...base, latitude: 91 })).toThrow();
    expect(() => gpsSchema.parse({ ...base, latitude: -91 })).toThrow();
  });
  test('speed/heading bounds', () => {
    expect(() => gpsSchema.parse({ ...base, speed: -1 })).toThrow();
    expect(() => gpsSchema.parse({ ...base, heading: 361 })).toThrow();
  });
  test('batteryLevel must be int 0–100', () => {
    expect(() => gpsSchema.parse({ ...base, batteryLevel: 50 })).not.toThrow();
    expect(() => gpsSchema.parse({ ...base, batteryLevel: 101 })).toThrow();
    expect(() => gpsSchema.parse({ ...base, batteryLevel: 50.5 })).toThrow();
  });
});

describe('gpsHistoryQuerySchema', () => {
  test('requires busId or tripId', () => {
    expect(() => gpsHistoryQuerySchema.parse({})).toThrow();
  });
  test('busId alone is sufficient', () => {
    expect(() => gpsHistoryQuerySchema.parse({ busId: UUID })).not.toThrow();
  });
  test('coerces limit from string', () => {
    const out = gpsHistoryQuerySchema.parse({ busId: UUID, limit: '50' });
    expect(out.limit).toBe(50);
  });
  test('caps limit at 5000', () => {
    expect(() => gpsHistoryQuerySchema.parse({ busId: UUID, limit: 9999 })).toThrow();
  });
});

describe('busSchema', () => {
  test('valid bus', () => {
    expect(() => busSchema.parse({ name: 'B', plateNumber: 'P', capacity: 30 })).not.toThrow();
  });
  test('capacity must be a positive int', () => {
    expect(() => busSchema.parse({ name: 'B', plateNumber: 'P', capacity: 0 })).toThrow();
    expect(() => busSchema.parse({ name: 'B', plateNumber: 'P', capacity: 12.5 })).toThrow();
  });
  test('status must be a known enum', () => {
    expect(() => busSchema.parse({ name: 'B', plateNumber: 'P', capacity: 1, status: 'broken' })).toThrow();
  });
});

describe('childSchema', () => {
  test('dateOfBirth must be YYYY-MM-DD', () => {
    expect(() => childSchema.parse({ firstName: 'a', lastName: 'b', dateOfBirth: '2020-01-01' })).not.toThrow();
    expect(() => childSchema.parse({ firstName: 'a', lastName: 'b', dateOfBirth: '01/01/2020' })).toThrow();
  });
});

describe('deviceTokenSchema', () => {
  test('platform must be ios/android/web', () => {
    expect(() => deviceTokenSchema.parse({ token: 'x'.repeat(20), platform: 'android' })).not.toThrow();
    expect(() => deviceTokenSchema.parse({ token: 'x'.repeat(20), platform: 'symbian' })).toThrow();
  });
  test('token min length', () => {
    expect(() => deviceTokenSchema.parse({ token: 'short', platform: 'ios' })).toThrow();
  });
});

describe('checkinSchema', () => {
  test('default method is manual', () => {
    const out = checkinSchema.parse({ tripId: UUID, childId: UUID, status: 'boarded' });
    expect(out.method).toBe('manual');
  });
  test('status must be known enum', () => {
    expect(() => checkinSchema.parse({ tripId: UUID, childId: UUID, status: 'lost' })).toThrow();
  });
});

describe('sosSchema', () => {
  test('all fields optional', () => {
    expect(() => sosSchema.parse({})).not.toThrow();
  });
  test('coordinates bounded when provided', () => {
    expect(() => sosSchema.parse({ latitude: 200, longitude: 0 })).toThrow();
  });
});