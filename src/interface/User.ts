export interface User {
  id: string;                    
  email: string;
  plan: "free" | "medium" | "pro";
  overrides_left: number;
  is_verified: boolean;
  created_at: number;            
}