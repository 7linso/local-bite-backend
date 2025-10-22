import { Recipe } from '../models/recipe.model.js'
import { resolveOrCreateLocation } from '../lib/location.js'

export const createRecipe = async (req, res) => {
    try {
        const userId = req.userId
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized.' })
        }

        const {
            title,
            description,
            ingredients,
            instructions,
            location,
            dishTypes,
        } = req.body

        if (!title || title.trim() === '')
            return res.status(400)
                .json({ message: 'Missing title.' })

        if (title.trim().length > 100)
            return res.status(400)
                .json({ message: 'Title is too long. Max 100 characters.' })

        const desc = typeof description === 'string' ? description.trim() : ''
        if (desc.length > 500)
            return res.status(400)
                .json({ message: 'Description is too long. Max 500 characters.' })

        if (!Array.isArray(ingredients) || ingredients.length === 0)
            return res.status(400)
                .json({ message: 'Missing ingredients.' })

        if (!Array.isArray(instructions) || instructions.length === 0)
            return res.status(400)
                .json({ message: 'Missing instructions.' })

        if (!location || typeof location !== 'object')
            return res.status(400)
                .json({ message: 'Invalid location payload.' })

        // normalize location fields
        const locality = String(location.locality ?? '').trim()
        const area = String(location.area ?? '').trim()
        const country = String(location.country ?? '').trim()

        const missing = []
        if (!locality)
            missing.push('locality')
        if (!area)
            missing.push('area')
        if (!country)
            missing.push('country')
        if (missing.length)
            return res.status(400)
                .json({ message: `Missing required location fields: ${missing.join(', ')}` })

        // resolve or create location 
        let locDoc
        try {
            locDoc = await resolveOrCreateLocation({ locality, area, country })
        } catch (e) {
            const msg = e?.message || 'Failed to geocode.'
            return res.status(400).json({ message: msg })
        }

        let point = locDoc.point
        if (!point)
            return res.status(400)
                .json({ message: 'Missing coordinates for this location.' })

        const newRecipe = new Recipe({
            authorId: userId,
            title: title.trim(),
            description: desc,
            ingredients,
            instructions,
            locationId: locDoc._id,
            point,
            locationSnapshot: { locality, area, country },
            dishTypes: Array.isArray(dishTypes) ? dishTypes : []
        })

        const saved = await newRecipe.save()

        await saved.populate({
            path: 'authorId',
            select: 'fullname username'
        }).lean()

        return res.status(201)
            .json({
                _id: saved._id,
                title: saved.title,
                description: saved.description,
                ingredients: saved.ingredients,
                instructions: saved.instructions,
                point: saved.point,
                locationSnapshot: saved.locationSnapshot,
                locationId: saved.locationId?._id,
                author: saved.authorId,
                dishTypes: saved.dishTypes ?? [],
                createdAt: saved.createdAt,
                updatedAt: saved.updatedAt
            })
    } catch (e) {
        if (e?.code === 11000)
            return res.status(409)
                .json({ message: 'A recipe with this title already exists for this author.' })

        console.error('Internal Server Error creating recipe:', e)
        return res.status(500)
            .json({ message: 'Failed to create recipe.' })
    }
}

export const getRecipe = async (req, res) => {
    try {
        const { recipeId } = req.params
        if (!recipeId)
            return res.status(400)
                .json({ message: 'Missing recipe id' })

        const recipe = await Recipe.findById(recipeId).populate({
            path: 'authorId',
            select: 'fullname username'
        }).lean()

        if (!recipe)
            return res.status(404)
                .json({ message: 'Recipe not found' })

        return res.status(200)
            .json({
                _id: recipe._id,
                title: recipe.title,
                description: recipe.description,
                ingredients: recipe.ingredients,
                instructions: recipe.instructions,
                point: recipe.point,
                locationSnapshot: recipe.locationSnapshot,
                locationId: recipe.locationId?._id,
                authorId: recipe.authorId,
                dishTypes: recipe.dishTypes ?? [],
                createdAt: recipe.createdAt,
                updatedAt: recipe.updatedAt
            })
    } catch (e) {
        console.log('Failed to get recipe')
        return res.status(404)
            .json({ message: 'Failed to get recipe' })
    }
}