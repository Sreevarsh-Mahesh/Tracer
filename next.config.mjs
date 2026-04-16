/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow tracer-sdk local path alias to resolve
  transpilePackages: ["tracer-sdk"],

  // Server-side only packages (not bundled for client)
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
