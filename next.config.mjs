/** @type {import('next').NextConfig} */
const security = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Camera and microphone are allowed on this origin only (avatar and voice capture).
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];
export default {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: { serverComponentsExternalPackages: ['mammoth', 'unpdf'] },
  async headers() { return [{ source: '/:path*', headers: security }]; },
};
