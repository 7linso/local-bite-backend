import express from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { createRecipe, getRecipe} from '../controllers/recipe.controller.js'

const router = express.Router()

router.post('/', requireAuth, createRecipe)

router.get('/:recipeId', getRecipe)

export default router