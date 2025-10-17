import express from 'express'
import {
    signup,
    signin,
    signout,
    me,
    updateProfilePic
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = express.Router()

router.post('/signup', signup)

router.post('/signin', signin)

router.post('/signout', signout)

router.get('/me', requireAuth, me)

router.patch('/update-profile-pic', requireAuth, updateProfilePic)

export default router