/** @type {import('next').NextConfig} */
const nextConfig = {
  // Load these with Node's require at runtime instead of bundling them.
  // read-excel-file -> unzipper has an optional AWS S3 import the bundler can't resolve.
  serverExternalPackages: ['read-excel-file', 'unzipper'],
};

export default nextConfig;
