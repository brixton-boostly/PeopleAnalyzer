import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { createClient } from './db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      id: 'credentials',
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const supabase = createClient()
        const { data: user } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, password_hash, must_reset_password')
          .eq('email', credentials.email as string)
          .single()
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.password_hash)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          mustResetPassword: user.must_reset_password,
        }
      },
    }),
    Credentials({
      id: 'magic-link-session',
      credentials: { userId: {} },
      async authorize(credentials) {
        if (!credentials?.userId) return null
        const supabase = createClient()
        const { data: user } = await supabase
          .from('users')
          .select('id, email, first_name, last_name, role, must_reset_password')
          .eq('id', credentials.userId as string)
          .single()
        if (!user) return null
        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role,
          mustResetPassword: user.must_reset_password,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (trigger === 'update' && session?.mustResetPassword === false) {
        token.mustResetPassword = false
      }
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.mustResetPassword = (user as any).mustResetPassword
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.mustResetPassword = token.mustResetPassword as boolean
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
})
