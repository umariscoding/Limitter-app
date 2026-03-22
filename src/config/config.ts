export const BASE_URL = 'https://nonremediably-nonbearded-miguel.ngrok-free.dev';

export const API = {
  // Auth
  LogIn: '/api/auth/login',
  SIGNUP: '/api/auth/signup',
  Logout: '/api/auth/logout',
  
  // Limits
  CreateLimit: '/api/limits/create',
  UpdateUsage: '/api/limits/update-usage',
  Override: '/api/limits/override',
  GetLimits: '/api/limits/:user_id/:device_id',
  DeleteLimit: '/api/limits/:limit_id',
};