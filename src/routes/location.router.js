import express from 'express'
import { getAllLoc, getAllLocCoords } from '../controllers/location.controller.js'
import { requireAuth } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/all', getAllLoc)
router.get('/all/coords', getAllLocCoords)

export default router