// backend/app/schemas/employee.py ile birebir eşleşir.
export interface EmployeeOut {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
  username?: string | null;
  age: number;
  address: string;
  branch_id?: number | null;
  region_id?: number | null;
  company_id?: number | null;
  is_active: boolean;
}

export interface EmployeeCreatePayload {
  first_name: string;
  last_name: string;
  role: string;
  age: number;
  address: string;
  username?: string | null;
  password?: string | null;
  branch_id?: number | null; // region_manager → branch_manager / vendor_manager → şube-scoped roller
  region_id?: number | null; // general_manager → region_manager / vendor_manager → region_manager
  company_id?: number | null; // sadece vendor_manager — hedef şirket
  manager_pin?: string | null; // sadece PIN_APPROVER_ROLES
}

export interface EmployeeUpdatePayload {
  first_name?: string;
  last_name?: string;
  age?: number;
  address?: string;
  is_active?: boolean;
  manager_pin?: string;
}

export interface PasswordResetPayload {
  new_password: string;
}
