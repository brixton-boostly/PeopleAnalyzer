import crypto from 'crypto'
import { createClient } from './db'

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function buildMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/auth/magic-link?token=${token}`
}

export function buildRetroUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/retro/${token}`
}

export async function createMagicLink(userId: string): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ user_id: userId, token, expires_at: expiresAt, type: 'review' })

  if (error) throw new Error(`Failed to create magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildMagicLinkUrl(token, baseUrl)
}

export async function createRetroMagicLink(
  employeeId: string,
  cycleId: string
): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  // 7-day expiry — employee may return to view their submission
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ employee_id: employeeId, cycle_id: cycleId, token, expires_at: expiresAt, type: 'retro' })

  if (error) throw new Error(`Failed to create retro magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildRetroUrl(token, baseUrl)
}

export async function redeemMagicLink(token: string): Promise<string | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .eq('type', 'review')
    .single()

  if (!link || link.used_at) return null
  if (new Date(link.expires_at) < new Date()) return null

  await supabase
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)

  return link.user_id
}

export async function validateRetroToken(
  token: string
): Promise<{ employeeId: string; cycleId: string } | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('employee_id, cycle_id, expires_at')
    .eq('token', token)
    .eq('type', 'retro')
    .single()

  if (!link) return null
  if (new Date(link.expires_at) < new Date()) return null

  return { employeeId: link.employee_id, cycleId: link.cycle_id }
}
