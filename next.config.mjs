/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker / Cloud Run deployment
  output: "standalone",

  // Allow tracer-sdk local path alias to resolve
  transpilePackages: ["tracer-sdk"],

  // Server-side only packages (not bundled for client)
  serverExternalPackages: [
    "@google-cloud/datastore",
    "@google-cloud/pubsub",
    "@google-cloud/storage",
  ],

};

export default nextConfig;
