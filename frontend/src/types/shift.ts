// backend/app/schemas/shift.py::ShiftOut ile birebir eşleşir.
export interface ShiftItem {
  employee_id: number;
  employee_name: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  is_day_off: boolean;
}

// backend/app/schemas/shift.py::RosterEmployee ile birebir eşleşir.
export interface RosterEmployee {
  id: number;
  first_name: string;
  last_name: string;
  role: string;
}

// backend/app/schemas/shift.py::ShiftUpsert ile birebir eşleşir.
export interface ShiftUpsertPayload {
  shift_date: string;
  start_time?: string | null;
  end_time?: string | null;
  is_day_off: boolean;
}
