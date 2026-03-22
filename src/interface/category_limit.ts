export interface CategoryLimit {
  id: string;
  user_id: string;
  device_id: string;
  category_id: string;
  max_time_minutes: number;
  time_used_minutes: number;
  is_blocked: boolean;
  created_at: number;
  updated_at: number;
}