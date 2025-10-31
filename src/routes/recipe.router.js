import express from 'express'
import { requireAuth } from '../middleware/auth.middleware.js'
import {
    createRecipe,
    getRecipe,
    deleteRecipe,
    editRecipe,
    getAllRecipes,
    likeRecipe,
    dislikeRecipe
} from '../controllers/recipe.controller.js'

const router = express.Router()

router.post('/', requireAuth, createRecipe)

router.get('/:recipeId', getRecipe)

router.delete('/:recipeId', requireAuth, deleteRecipe)

router.patch('/:recipeId', requireAuth, editRecipe)

router.patch('/:recipeId/like', requireAuth, likeRecipe)

router.patch('/:recipeId/dislike', requireAuth, dislikeRecipe)

router.get('/', getAllRecipes)

export default router