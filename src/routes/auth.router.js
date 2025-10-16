import express from 'express'
import { signup, signin, signout, me } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = express.Router()

router.post('/signup', signup)

router.post('/signin', signin)

router.post('/signout', signout)

router.get('/me', requireAuth, me)

export default router