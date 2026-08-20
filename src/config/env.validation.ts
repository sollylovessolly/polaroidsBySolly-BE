export function validateEnvironment(values: Record<string, unknown>) {
  if (values.NODE_ENV !== 'production') return values;
  const required = [
    'DATABASE_URL',
    'DIRECT_URL',
    'JWT_SECRET',
    'FRONTEND_URL',
    'PAYSTACK_SECRET_KEY',
  ];
  const read = (name: string) =>
    typeof values[name] === 'string' ? values[name].trim() : '';
  const missing = required.filter((name) => !read(name));
  if (missing.length)
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}`,
    );
  if (read('JWT_SECRET').length < 32)
    throw new Error('JWT_SECRET must contain at least 32 characters');
  for (const name of ['FRONTEND_URL', 'ADMIN_FRONTEND_URL']) {
    const configured = read(name);
    if (configured) {
      const url = new URL(configured);
      if (url.protocol !== 'https:' && url.hostname !== 'localhost')
        throw new Error(`${name} must use HTTPS in production`);
    }
  }
  return values;
}
