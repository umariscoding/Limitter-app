export interface Plan {
  name: "free" | "pro" | "elite";
  max_overrides: number;
  price: number;                  // monthly price dega
  description: string;            // optional details
}