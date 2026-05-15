export interface User {
  id: string;
  email: string;
  fullName: string;
  type: "0" | "1";
  token?: string;
}

export interface SessionData {
  id: string;
  createdAt: string;
  measures_number: number;
  state: "0" | "1";
  update_count: number;
  chloro_pending_count: number;
  user: {
    name: string;
    email: string;
  };
}
