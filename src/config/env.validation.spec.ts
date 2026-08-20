import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
  it('fails cleanly when required production configuration is missing', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Missing required production configuration',
    );
  });

  it('does not require provider credentials in tests', () => {
    expect(validateEnvironment({ NODE_ENV: 'test' })).toEqual({
      NODE_ENV: 'test',
    });
  });
});
