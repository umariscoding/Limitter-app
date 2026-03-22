export interface Plan {
  name: "free" | "medium" | "pro";
  max_overrides: number;
  price: number;                  // monthly price dega
  description: string;            // optional details
}