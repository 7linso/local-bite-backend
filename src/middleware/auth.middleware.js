import jwt from 'jsonwebtoken'

export const requireAuth = (req, res, next) => {
    const token = req.cookies?.jwt
    if (!token)
        return res.status(401).json({ message: 'Unauthorized' })

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        req.userId = payload.userId
        next()
    } catch (e) {
        return res.status(401).json({ message: 'Unauthorized' })
    }
}
