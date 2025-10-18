import jwt from "jsonwebtoken";

export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt
    if (!token) return res.status(401).json({ message: 'Unauthorized - No Token' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const userId = decoded.userId         

    if (!userId) return res.status(401).json({ message: 'Unauthorized - Bad Token' })

    req.userId = userId

    next()
  } catch (e) {
    console.error('requireAuth error:', e)
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

