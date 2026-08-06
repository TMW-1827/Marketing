import type { EmployeeReportRow } from '@/lib/supabase'

/**
 * Вигаданий звіт для демонстраційного режиму.
 *
 * Потрібен, щоб екран адмінки можна було перевірити до підключення бази:
 * порожня таблиця нічого не показує ні про верстку, ні про сортування.
 * Дані свідомо неправдоподібні як реальні — прізвищ немає, лише ролі,
 * а на самій сторінці стоїть попередження, що це зразок.
 */

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString()

export const DEMO_REPORT: EmployeeReportRow[] = [
  {
    user_id: 'demo-admin',
    full_name: 'Тест Керівник',
    position: 'Керівник відділу продажів',
    region: 'Київ',
    role: 'admin',
    course_id: 'truskavetska-basics',
    sections_done: 12,
    best_score: 20,
    passed_at: daysAgo(9),
    last_activity: daysAgo(1),
    attempts: 1,
  },
  {
    user_id: 'demo-employee',
    full_name: 'Тест Працівник',
    position: 'Торговий представник',
    region: 'Львівська обл.',
    role: 'employee',
    course_id: 'truskavetska-basics',
    sections_done: 4,
    best_score: 14,
    passed_at: null,
    last_activity: daysAgo(2),
    attempts: 2,
  },
  {
    user_id: 'demo-3',
    full_name: 'Зразок: мерчандайзер',
    position: 'Мерчандайзер',
    region: 'Дніпропетровська обл.',
    role: 'employee',
    course_id: 'truskavetska-basics',
    sections_done: 12,
    best_score: 18,
    passed_at: daysAgo(4),
    last_activity: daysAgo(4),
    attempts: 3,
  },
  {
    user_id: 'demo-4',
    full_name: 'Зразок: супервайзер',
    position: 'Супервайзер',
    region: 'Одеська обл.',
    role: 'employee',
    course_id: 'truskavetska-basics',
    sections_done: 9,
    best_score: 15,
    passed_at: null,
    last_activity: daysAgo(6),
    attempts: 1,
  },
  {
    user_id: 'demo-5',
    full_name: 'Зразок: новий працівник',
    position: 'Торговий представник',
    region: 'Харківська обл.',
    role: 'employee',
    course_id: null,
    sections_done: 0,
    best_score: null,
    passed_at: null,
    last_activity: null,
    attempts: 0,
  },
]
