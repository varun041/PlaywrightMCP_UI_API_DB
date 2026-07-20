export const Urls = {
  FRONTEND_BASE_URL: process.env.FRONTEND_BASE_URL ?? 'http://localhost:3001',
  API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000/api/',
} as const;
