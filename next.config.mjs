/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static output: deployable anywhere and wrappable with Capacitor (webDir: "out").
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
