import { buildRetroUrl } from '@/lib/magic-link'

describe('buildRetroUrl', () => {
  it('returns a /retro/[token] URL', () => {
    const url = buildRetroUrl('abc123', 'http://localhost:3000')
    expect(url).toBe('http://localhost:3000/retro/abc123')
  })

  it('uses different base URLs', () => {
    const url = buildRetroUrl('tok', 'https://boostly-people-analyzer.vercel.app')
    expect(url).toBe('https://boostly-people-analyzer.vercel.app/retro/tok')
  })
})
