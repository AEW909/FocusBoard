export type StaffRole = "owner" | "clinician" | "admin";

export type StaffProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: StaffRole;
};
