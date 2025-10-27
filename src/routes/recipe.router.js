import express from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import { createRecipe, getRecipe, deleteRecipe, getAllRecipes} from '../controllers/recipe.controller.js'

const router = express.Router()

router.post('/', requireAuth, createRecipe)

router.get('/:recipeId', getRecipe)

router.delete('/:recipeId', requireAuth, deleteRecipe)

router.get('/', getAllRecipes)

export default router