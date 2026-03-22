export interface AppCategory {
  id: string;             // category ID
  name: string;           // e.g., Social, Productivity
  apps: string[];         // list of app package names
  created_at: number;
  updated_at: number;
}