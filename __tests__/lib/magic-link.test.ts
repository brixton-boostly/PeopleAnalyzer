import { generateToken, buildMagicLinkUrl } from '@/lib/magic-link'

describe('generateToken', () => {
  it('returns a 64-character hex string', () => {
    const token = generateToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns a different token each time', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('buildMagicLinkUrl', () => {
  it('returns a URL with the token as a query param', () => {
    const url = buildMagicLinkUrl('abc123', 'http://localhost:3000')
    expect(url).toBe('http://localhost:3000/api/auth/magic-link?token=abc123')
  })
})
