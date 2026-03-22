export interface SessionHistory {
  id: string;
  user_id: string;
  device_id: string;
  app_name: string;
  category_id: string;
  session_start: number;
  session_end: number;
  duration_minutes: number;
}