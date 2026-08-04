import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from '@/lib/config'

/** Профіль працівника — рядок таблиці public.profiles. */
export type Profile = {
  id: string
  full_name: string
  position: string | null
  region: string | null
  role: 'employee' | 'admin'
  created_at: string
}

export type ProgressRow = {
  user_id: string
  course_id: string
  completed_sections: string[]
  best_score: number | null
  passed_at: string | null
  updated_at: string
}

export type QuizAttemptRow = {
  id: string
  user_id: string
  course_id: string
  score: number
  total: number
  passed: boolean
  created_at: string
}

/** Рядок звіту для адмінки — представлення public.employee_report. */
export type EmployeeReportRow = {
  user_id: string
  full_name: string
  position: string | null
  region: string | null
  role: 'employee' | 'admin'
  course_id: string | null
  sections_done: number
  best_score: number | null
  passed_at: string | null
  last_activity: string | null
  attempts: number
}

/**
 * Форма типу, якої очікує supabase-js: кожна таблиця має Row/Insert/Update
 * і Relationships, а поруч — Views, Functions, Enums, CompositeTypes.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string; full_name: string }
        Update: Partial<Profile>
        Relationships: []
      }
      progress: {
        Row: ProgressRow
        Insert: Partial<ProgressRow> & { user_id: string; course_id: string }
        Update: Partial<ProgressRow>
        Relationships: []
      }
      quiz_attempts: {
        Row: QuizAttemptRow
        Insert: Omit<QuizAttemptRow, 'id' | 'created_at'>
        Update: Partial<QuizAttemptRow>
        Relationships: []
      }
    }
    Views: {
      employee_report: {
        Row: EmployeeReportRow
        Relationships: []
      }
    }
    // Порожні розділи описуємо саме літералом {}: індексна сигнатура тут
    // перехоплювала б імена таблиць і ламала виведення типів у select().
    Functions: {}
    Enums: {
      user_role: 'employee' | 'admin'
    }
    CompositeTypes: {}
  }
}

/**
 * Клієнт Supabase. null, якщо бекенд не налаштований —
 * у цьому режимі портал працює локально (див. lib/config.ts).
 *
 * Тип виводиться з createClient: явна анотація SupabaseClient<Database>
 * підставляє дефолти решти параметрів і губить типи таблиць.
 */
export const supabase = supabaseConfig
  ? createClient<Database>(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // сесія має переживати перезапуск додатка на телефоні
        storageKey: 'tr-portal-auth',
      },
    })
  : null
