import 'server-only'
import { jwtVerify } from 'jose'
 
const secretKey = process.env.SESSION_SECRET
const encodedKey = new TextEncoder().encode(secretKey)

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ['HS256'],
    })
    return payload
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    console.log('Failed to verify session')
  }
}