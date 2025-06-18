export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          identity_number: string;
          role: 'student' | 'department_admin' | 'super_admin';
          department_id: string | null;
          study_program_id: string | null;
          phone_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string; // This should match the Supabase Auth user ID
          email: string;
          full_name: string;
          identity_number: string;
          role?: 'student' | 'department_admin' | 'super_admin';
          department_id?: string | null;
          study_program_id?: string | null;
          phone_number?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          identity_number?: string;
          role?: 'student' | 'department_admin' | 'super_admin';
          department_id?: string | null;
          study_program_id?: string | null;
          phone_number?: string | null;
          updated_at?: string;
        };
      };
      departments: {
        Row: {
          id: string;
          name: string;
          code: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      rooms: {
        Row: {
          id: string;
          name: string;
          code: string;
          capacity: number;
          department_id: string;
          equipment: string[];
          is_available: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          capacity: number;
          department_id: string;
          equipment?: string[];
          is_available?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          capacity?: number;
          department_id?: string;
          equipment?: string[];
          is_available?: boolean;
          updated_at?: string;
        };
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          room_id: string;
          start_time: string;
          end_time: string;
          purpose: string;
          sks: number;
          class_type: 'theory' | 'practical';
          status: 'pending' | 'approved' | 'rejected' | 'completed';
          equipment_requested: string[];
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room_id: string;
          start_time: string;
          end_time: string;
          purpose: string;
          sks: number;
          class_type: 'theory' | 'practical';
          status?: 'pending' | 'approved' | 'rejected' | 'completed';
          equipment_requested?: string[];
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          room_id?: string;
          start_time?: string;
          end_time?: string;
          purpose?: string;
          sks?: number;
          class_type?: 'theory' | 'practical';
          status?: 'pending' | 'approved' | 'rejected' | 'completed';
          equipment_requested?: string[];
          notes?: string | null;
          updated_at?: string;
        };
      };
      equipment: {
        Row: {
          id: string;
          name: string;
          code: string;
          category: string;
          is_mandatory: boolean;
          is_available: boolean;
          department_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          category: string;
          is_mandatory?: boolean;
          is_available?: boolean;
          department_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          category?: string;
          is_mandatory?: boolean;
          is_available?: boolean;
          department_id?: string | null;
          updated_at?: string;
        };
      };
      study_programs: {
        Row: {
          id: string;
          name: string;
          code: string;
          department_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          department_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          department_id?: string;
          updated_at?: string;
        };
      };
      exams: {
        Row: {
          id: string;
          day: string;
          date: string;
          session: string;
          course_code: string;
          semester: number;
          class: string;
          student_amount: number;
          room_id: string;
          lecturer_id: string;
          department_id: string;
          study_program_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          day: string;
          date: string;
          session: string;
          course_code: string;
          semester: number;
          class: string;
          student_amount: number;
          room_id: string;
          lecturer_id: string;
          department_id: string;
          study_program_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          day?: string;
          date?: string;
          session?: string;
          course_code?: string;
          semester?: number;
          class?: string;
          student_amount?: number;
          room_id?: string;
          lecturer_id?: string;
          department_id?: string;
          study_program_id?: string;
          updated_at?: string;
        };
      };
    };
  };
}