export interface OverrideHistory {
  id: string;
  user_id: string;
  device_id: string;
  limit_id: string;
  used_at: number;
  overrides_before: number;
  overrides_after: number;
}