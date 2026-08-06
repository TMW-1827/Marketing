import type { Profile } from '@/lib/supabase'

/**
 * Демонстраційний вхід — для перевірки порталу, поки бекенду немає.
 *
 * Акаунти вбудовані в збірку, паролі відкриті: це навмисно, бо перевіряти
 * потрібні саме сценарії входу, ролей і виходу. Реальних даних тут немає
 * і бути не може — режим вмикається лише прапорцем VITE_DEMO_AUTH і сам
 * собою вимикається, щойно з'являються ключі Supabase.
 *
 * Пошта й паролі збігаються з supabase/seed/test_accounts.sql, щоб після
 * підключення бази ті самі облікові записи працювали без переучування.
 */

export interface DemoAccount {
  email: string
  password: string
  profile: Profile
}

function profile(
  id: string,
  full_name: string,
  position: string,
  region: string,
  role: 'employee' | 'admin',
): Profile {
  return {
    id,
    full_name,
    position,
    region,
    role,
    created_at: '2026-07-01T09:00:00.000Z',
  }
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'pracivnyk@truskavetska.test',
    password: 'Test1234!',
    profile: profile(
      'demo-employee',
      'Тест Працівник',
      'Торговий представник',
      'Львівська обл.',
      'employee',
    ),
  },
  {
    email: 'kerivnyk@truskavetska.test',
    password: 'Admin1234!',
    profile: profile(
      'demo-admin',
      'Тест Керівник',
      'Керівник відділу продажів',
      'Київ',
      'admin',
    ),
  },
]

export function findDemoAccount(
  email: string,
  password: string,
): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase()
  return DEMO_ACCOUNTS.find(
    (a) => a.email === normalized && a.password === password,
  )
}

export function demoAccountById(id: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.profile.id === id)
}
