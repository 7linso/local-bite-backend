import jwt from 'jsonwebtoken'
import 'dotenv/config'

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

  const isProd = process.env.NODE_ENV === 'production'

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: isProd,        
    sameSite: 'lax',       
    path: '/',             
    maxAge: 7 * 24 * 60 * 60 * 1000, 
  })

  return token
}
