import { Recipe } from '../models/recipe.model.js'
import { resolveOrCreateLocation } from '../lib/location.js'
import cloudinary from "../lib/cloudinary.js"

const escapeRegex = (s) => {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export const createRecipe = async (req, res) => {
    try {
        const userId = req.userId
        if (!userId)
            return res.status(401)
                .json({ message: 'Unauthorized.' })

        const {
            recipePic,
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

        if (typeof recipePic !== 'string')
            return res
                .status(400)
                .json({ message: 'Recipe picture is of wrong format.' })

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

        const isDataUrl = recipePic.startsWith('data:')
        const uploadSource = isDataUrl ? recipePic : `data:image/jpeg;base64,${recipePic}`

        const upload = await cloudinary.uploader.upload(uploadSource, {
            folder: `local-bite/users/${userId}/recipes`
        })

        if (!upload?.secure_url)
            return res
                .status(502)
                .json({ message: 'Upload failed.' })

        const newRecipe = new Recipe({
            authorId: userId,
            title: title.trim(),
            description: desc,
            recipePic: {
                imageURL: upload.secure_url,
                publicId: upload.public_id,
                postedAt: new Date(upload.created_at || Date.now())
            },
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
        })

        return res.status(201)
            .json({
                _id: saved._id,
                title: saved.title,
                description: saved.description,
                recipePic: {
                    imageURL: upload.secure_url,
                    publicId: upload.public_id,
                    postedAt: new Date(upload.created_at || Date.now())
                },
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
                recipePic: recipe.recipePic.imageURL,
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

export const getAllRecipes = async (req, res) => {
    try {
        const {
            limit = '20',
            cursor,
            q,
            dishTypes,
            country,
            authorId,
            nearLng, nearLat, maxKm,
            sort = 'createdAt:desc'
        } = req.query

        const filter = {}

        if (authorId)
            filter.authorId = authorId

        if (dishTypes) {
            const arr = dishTypes.split(',').map(s => s.trim()).filter(Boolean)
            if (arr.length)
                filter.dishTypes = { $in: arr }
        }

        if (country)
            filter['locationSnapshot.country'] = country

        if (q && q.trim()) {
            const rx = new RegExp(escapeRegex(q.trim()), 'i')
            filter.$or = [
                { title: rx },
                { description: rx },
                { 'ingredients.ingredient': rx },
            ]
        }

        if (nearLng && nearLat) {
            const maxMeters = Number(maxKm ?? '10') * 1000
            filter.point = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [Number(nearLng), Number(nearLat)]
                    },
                    $maxDistance: maxMeters,
                },
            }
        }

        const pageSize = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100)

        let [sortField, sortDir] = sort.split(':')
        if (!sortField)
            sortField = 'createdAt'

        const sortOrder = sortDir === 'asc' ? 1 : -1

        const useIdCursor = sortField === 'createdAt' && sortOrder === -1 && !nearLng

        if (cursor && useIdCursor)
            filter._id = { $lt: cursor }

        const projection = {
            _id: 1,
            title: 1,
            description: 1,
            dishTypes: 1,
            ingredients: 1,
            instructions: 1,
            point: 1,
            locationSnapshot: 1,
            locationId: 1,
            authorId: 1,
            createdAt: 1,
            updatedAt: 1,
            recipePic: { $ifNull: ['$recipePic.imageURL', null] },
        }

        const pipeline = [{ $match: filter }]

        if (!nearLng) {
            pipeline.push({ $sort: { [sortField]: sortOrder, _id: -1 } })
            if (!useIdCursor && cursor) { }
        } else {
            pipeline.shift()
            pipeline.unshift({
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [Number(nearLng), Number(nearLat)]
                    },
                    distanceField: 'distM',
                    maxDistance: Number(maxKm ?? '10') * 1000,
                    query: filter,
                    spherical: true,
                }
            })
        }

        pipeline.push({
            $project: {
                _id: 1,
                title: 1,
                description: 1,
                dishTypes: 1,
                ingredients: 1,
                instructions: 1,
                point: 1,
                locationSnapshot: 1,
                locationId: 1,
                authorId: 1,
                createdAt: 1,
                updatedAt: 1,
                recipePic: '$recipePic.imageURL',
                ...(nearLng ? { distM: 1 } : {})
            }
        })

        pipeline.push({ $limit: pageSize + 1 })

        const docs = await Recipe
            .aggregate(pipeline)
            .collation({ locale: 'en', strength: 2 })

        const hasNextPage = docs.length > pageSize
        const items = hasNextPage ? docs.slice(0, pageSize) : docs
        const nextCursor = hasNextPage ? String(items[items.length - 1]._id) : null

        return res.status(200).json({
            items,
            nextCursor,
            hasNextPage,
            pageSize,
            count: items.length,
        })
    } catch (e) {
        console.log('Failed to get all recipes')
        return res.status(404)
            .json({ message: 'Failed to get all recipes' })
    }
}

export const deleteRecipe = async (req, res) => {
    try {
        const userId = req.userId
        const { recipeId } = req.params

        if (!userId)
            return res.status(401)
                .json({ message: 'Unauthorized.' })

        if (!recipeId)
            return res.status(400)
                .json({ message: 'Missing recipe id.' })

        const recipe = await Recipe.findById(recipeId)

        if (!recipe)
            return res.status(404)
                .json({ message: 'Recipe not found.' })

        if (recipe.authorId.toString() !== userId.toString())
            return res.status(403)
                .json({ message: 'Unauthorized to delete this recipe.' })

        const recipePic = recipe.recipePic
        if (recipePic)
            await cloudinary.uploader.destroy(recipePic.publicId, { resource_type: "image" })

        await Recipe.deleteOne({ _id: recipeId })

        return res.status(200)
            .json({ message: 'Recipe Deleted!' })

    } catch (e) {
        console.log('Error deleting recipe', e)
        return res.status(400)
            .json({ message: 'Internal Server Error deleting recipe.' })
    }
}

export const editRecipe = async (req, res) => {
    try {
        const userId = req.userId
        const { recipeId } = req.params

        if (!userId)
            return res.status(401)
                .json({ message: 'Unauthorized.' })

        if (!recipeId)
            return res.status(400)
                .json({ message: 'Missing recipe id.' })

        const recipe = await Recipe.findById(recipeId)

        if (!recipe)
            return res.status(404)
                .json({ message: 'Recipe not found.' })

        if (recipe.authorId.toString() !== userId.toString())
            return res.status(403)
                .json({ message: 'Unauthorized to edit this recipe.' })

        const body = req.body || {}

        const {
            recipePic,
            title,
            description,
            ingredients,
            instructions,
            location,
            dishTypes,
        } = body


        const updated = {}

        if (title !== undefined && title !== recipe.title) {
            if (!title || title.trim() === '')
                return res.status(400)
                    .json({ message: 'Missing title.' })

            if (title.trim().length > 100)
                return res.status(400)
                    .json({ message: 'Title is too long. Max 100 characters.' })

            updated.title = title.trim()
        }

        if (description !== undefined && description !== recipe.description) {
            const desc = typeof description === 'string' ? description.trim() : ''
            if (desc.length > 500)
                return res.status(400)
                    .json({ message: 'Description is too long. Max 500 characters.' })

            updated.description = description.trim()
        }

        if (recipePic !== undefined && recipePic !== recipe.recipePic.imageURL) {
            if (typeof recipePic !== 'string')
                return res
                    .status(400)
                    .json({ message: 'Recipe picture is of wrong format.' })

            const oldPic = recipe.recipePic.publicId

            const isDataUrl = recipePic.startsWith('data:')
            const uploadSource = isDataUrl ? recipePic : `data:image/jpeg;base64,${recipePic}`

            const upload = await cloudinary.uploader.upload(uploadSource, {
                folder: `local-bite/users/${userId}/recipes`
            })

            if (!upload?.secure_url)
                return res
                    .status(502)
                    .json({ message: 'Upload failed.' })

            updated.recipePic = {
                imageURL: upload.secure_url,
                publicId: upload.public_id,
                postedAt: new Date(upload.created_at || Date.now())
            }

            if (oldPic)
                await cloudinary.uploader.destroy(oldPic, { resource_type: "image" })

        }

        if (ingredients !== undefined && ingredients && ingredients !== recipe.ingredients) {
            if (!Array.isArray(ingredients) || ingredients.length === 0) {
                return res.status(400).json({ message: 'Missing ingredients.' })
            }

            const cleanedIngredients = ingredients.map((ing) => ({
                ingredient: String(ing.ingredient || '').trim(),
                amount: Number(ing.amount) || 0,
                measure: String(ing.measure || '').trim(),
            }))

            if (cleanedIngredients.some(ing => !ing.ingredient)) {
                return res.status(400).json({ message: 'Ingredient name is required.' })
            }

            updated.ingredients = cleanedIngredients
        }

        if (instructions !== undefined && instructions && instructions !== recipe.instructions) {
            if (!Array.isArray(instructions) || instructions.length === 0) {
                return res.status(400).json({ message: 'Missing instructions.' })
            }

            const cleanedInstructions = instructions
                .map(s => String(s || '').trim())
                .filter(s => s.length > 0)

            if (!cleanedInstructions.length) {
                return res.status(400).json({ message: 'Missing instructions.' })
            }

            updated.instructions = cleanedInstructions
        }

        // --- location ---
        if (location !== undefined) {
            if (!location || typeof location !== 'object') {
                return res.status(400).json({ message: 'Invalid location payload.' })
            }

            const locality = String(location.locality ?? '').trim()
            const area = String(location.area ?? '').trim()
            const country = String(location.country ?? '').trim()

            const missing = []
            if (!locality) missing.push('locality')
            if (!area) missing.push('area')
            if (!country) missing.push('country')

            if (missing.length) {
                return res.status(400).json({
                    message: `Missing required location fields: ${missing.join(', ')}`
                })
            }

            const locationChanged =
                locality !== recipe.locationSnapshot.locality ||
                area !== recipe.locationSnapshot.area ||
                country !== recipe.locationSnapshot.country

            if (locationChanged) {
                const locDoc = await resolveOrCreateLocation({ locality, area, country })

                if (!locDoc?.point) {
                    return res.status(400).json({
                        message: 'Missing coordinates for this location.'
                    })
                }

                updated.locationId = locDoc._id
                updated.locationSnapshot = {
                    locality,
                    area,
                    country
                }
                updated.point = locDoc.point
            }
        }


        if (dishTypes !== undefined && dishTypes && dishTypes !== recipe.dishTypes) {
            if (!Array.isArray(dishTypes))
                return res.status(400).json({ message: 'dishTypes must be an array.' })

            updated.dishTypes = dishTypes.map(x => String(x || '').trim()).filter(Boolean)
        }

        const updatedRecipe = await Recipe.findByIdAndUpdate(
            recipeId,
            { $set: updated },
            { new: true }
        )

        await updatedRecipe.populate({
            path: 'authorId',
            select: 'fullname username'
        })

        return res.status(200).json({
            _id: updatedRecipe._id,
            title: updatedRecipe.title,
            description: updatedRecipe.description,
            recipePic: updatedRecipe.recipePic?.imageURL,
            ingredients: updatedRecipe.ingredients,
            instructions: updatedRecipe.instructions,
            point: updatedRecipe.point,
            locationSnapshot: updatedRecipe.locationSnapshot,
            locationId: updatedRecipe.locationId?._id,
            authorId: updatedRecipe.authorId,
            dishTypes: updatedRecipe.dishTypes ?? [],
            createdAt: updatedRecipe.createdAt,
            updatedAt: updatedRecipe.updatedAt
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