export interface AppUsage {
  id: string;
  user_id: string;
  device_id: string;
  app_name: string;
  category_id: string;
  date: string;  // YYYY-MM-DD
  total_time_minutes: number;
  session_count: number;
  created_at: number;
  updated_at: number;
}