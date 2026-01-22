export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "0" | "1";
  token?: string;
}

export interface SessionData {
  id: string;
  createdAt: string;
  measures_number: number;
  user: {
    full_name: string;
    email: string;
  };
}
