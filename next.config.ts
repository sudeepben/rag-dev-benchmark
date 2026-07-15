import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "@pinecone-database/pinecone"],
};

export default nextConfig;
