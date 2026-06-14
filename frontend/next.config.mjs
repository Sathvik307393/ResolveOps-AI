const nextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api-gateway-service:8000/:path*', // Forward to the API Gateway Docker service
      },
    ];
  },
};

export default nextConfig;
