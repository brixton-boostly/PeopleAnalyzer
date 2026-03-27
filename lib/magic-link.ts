import crypto from 'crypto'
import { createClient } from './db'

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function buildMagicLinkUrl(token: string, baseUrl: string): string {
  return `${baseUrl}/api/auth/magic-link?token=${token}`
}

export async function createMagicLink(userId: string): Promise<string> {
  const supabase = createClient()
  const token = generateToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('magic_links')
    .insert({ user_id: userId, token, expires_at: expiresAt })

  if (error) throw new Error(`Failed to create magic link: ${error.message}`)

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  return buildMagicLinkUrl(token, baseUrl)
}

export async function redeemMagicLink(token: string): Promise<string | null> {
  const supabase = createClient()

  const { data: link } = await supabase
    .from('magic_links')
    .select('id, user_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!link || link.used_at) return null
  if (new Date(link.expires_at) < new Date()) return null

  await supabase
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', link.id)

  return link.user_id
}
