export interface User {
  id: string;                    
  email: string;
  plan: "free" | "pro" | "elite";
  overrides_left: number;
  is_verified: boolean;
  created_at: number;            
}