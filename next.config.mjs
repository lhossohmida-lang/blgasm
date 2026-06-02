const isAndroidBuild = process.env.CAPACITOR_BUILD === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: isAndroidBuild ? "export" : "standalone",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
