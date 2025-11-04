import bcrypt from "bcryptjs"
import cloudinary from "../lib/cloudinary.js"
import { User } from "../models/auth.model.js"
import { Recipe } from "../models/recipe.model.js"
import { generateToken } from '../lib/utils.js'
import { resolveOrCreateLocation } from '../lib/location.js'
import 'dotenv/config'

export const signup = async (req, res) => {
    // unpack data
    const { fullname, username, email, password } = req.body

    try {
        // return if data is missing
        if (!fullname || !username || !email || !password)
            return res
                .status(400)
                .json({ message: 'Missing credentials.' })

        // basic pwd check
        if (password.length < 8)
            return res
                .status(400)
                .json({ message: 'Password must be at least 8 characters long.' })

        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        if (!isEmail)
            return res
                .status(400)
                .json('Not valid email')

        const normalizedEmail = email.trim().toLowerCase()

        // don't create user if email is already taken
        const usedEmail = await User.findOne({ email: normalizedEmail }).lean()
        if (usedEmail)
            return res
                .status(400)
                .json({ message: 'This email is already used.' })

        const normalizedUsername = username.trim()

        // don't create user if username is already taken
        const usedUsername = await User.findOne({ username: normalizedUsername }).lean()
        if (usedUsername)
            return res
                .status(400)
                .json({ message: 'This username is already used.' })

        // hash pwd cause it is a must
        const salt = await bcrypt.genSalt(12)
        const hashedPassword = await bcrypt.hash(password, salt)

        const newUser = new User({
            fullname,
            username,
            email,
            password: hashedPassword
        })

        if (!newUser)
            return res
                .status(400)
                .json({ message: 'Invalid user data.' })


        await newUser.save()
        // giving jwt in cookies 
        generateToken(newUser._id, res)

        return res
            .status(201)
            .json({
                _id: newUser._id,
                fullname: newUser.fullname,
                username: newUser.username,
                email: newUser.email,
                bio: newUser.bio ?? null,
                createdAt: newUser.createdAt,
                updatedAt: newUser.updatedAt,
                profilePic: newUser.profilePic?.imageURL ?? null,
                favs: newUser.favs ?? null,
                defaultLocationId: newUser.defaultLocationId?._id ?? null,
                defaultLocation: newUser.defaultLocationId
                    ? {
                        _id: newUser.defaultLocationId._id,
                        locality: newUser.defaultLocationId.locality,
                        area: newUser.defaultLocationId.area,
                        country: newUser.defaultLocationId.country
                    } : null
            })

    } catch (e) {
        console.log(`Error signing up: ${e}`);
        return res
            .status(400)
            .json({ message: 'Internal Server Error creating account.' })
    }
}

export const signin = async (req, res) => {
    // unpack data
    const { identifier, password } = req.body

    try {
        // return if data is missing
        if (!identifier || !password)
            return res
                .status(400)
                .json({ message: 'Missing creadentials.' })

        // clean up just in case
        const login = String(identifier).trim();
        // determine what user used for auth
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);

        const user = await User.findOne(
            isEmail ?
                { email: login.toLowerCase() }
                :
                { username: login }
        ).populate({
            path: 'defaultLocationId',
            select: 'locality area country'
        })

        if (!user)
            return res
                .status(400)
                .json({ message: 'Invalid creadentials.' })

        // comparing input with db
        const isPassword = await bcrypt.compare(password, user.password)

        if (!isPassword)
            return res
                .status(400)
                .json({ message: 'Invalid creadentials.' })

        // giving jwt in cookies
        generateToken(user._id, res)

        return res
            .status(200)
            .json({
                _id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                bio: user.bio ?? null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profilePic: user.profilePic?.imageURL ?? null,
                favs: user.favs ?? null,
                defaultLocationId: user.defaultLocationId?._id ?? null,
                defaultLocation: user.defaultLocationId
                    ? {
                        _id: user.defaultLocationId._id,
                        locality: user.defaultLocationId.locality,
                        area: user.defaultLocationId.area,
                        country: user.defaultLocationId.country
                    } : null
            })

    } catch (e) {
        console.log(`Error signing in: ${e}`);
        return res
            .status(400)
            .json({ message: 'Internal Server Error signing in.' })
    }
}

export const signout = async (req, res) => {
    try {
        // just removing session
        res.cookie('jwt', '', { maxAge: 0 })

        return res
            .status(200)
            .json({ message: 'Logged Out' })
    } catch (e) {
        console.log(`Error signing out: ${e}`);
        return res
            .status(400)
            .json({ message: 'Internal Server Error signing out.' })
    }
}

export const me = async (req, res) => {
    try {
        const user = await User
            .findById(req.userId)
            .populate({
                path: 'defaultLocationId',
                select: 'locality area country'
            })

        if (!user)
            return res
                .status(404)
                .json({ message: 'User not found' })

        return res
            .status(200)
            .json({
                _id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                bio: user.bio ?? null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profilePic: user.profilePic?.imageURL ?? null,
                favs: user.favs ?? null,
                defaultLocationId: user.defaultLocationId?._id ?? null,
                defaultLocation: user.defaultLocationId
                    ? {
                        _id: user.defaultLocationId._id,
                        locality: user.defaultLocationId.locality,
                        area: user.defaultLocationId.area,
                        country: user.defaultLocationId.country
                    } : null
            })
    } catch (e) {
        res.status(500)
            .json({ message: 'Internal Server Error' })
    }
}

export const updateProfilePic = async (req, res) => {
    let { profilePic } = req.body

    try {
        const userId = req.userId

        if (!userId)
            return res
                .status(401)
                .json({ message: 'Unauthorized.' })

        if (!profilePic || typeof profilePic !== 'string')
            return res
                .status(400)
                .json({ message: 'Profile picture is required.' })

        const user = await User.findById(userId).lean()
        if (!user)
            return res
                .status(404)
                .json({ message: 'User not found.' })

        const oldPublicId = user.profilePic?.publicId || null;

        profilePic = profilePic.trim()
        const isDataUrl = profilePic.startsWith('data:')
        const uploadSource = isDataUrl ? profilePic : `data:image/jpeg;base64,${profilePic}`

        const upload = await cloudinary.uploader.upload(uploadSource, {
            folder: `local-bite/users/${userId}/profile`
        })

        if (!upload?.secure_url)
            return res
                .status(502)
                .json({ message: 'Upload failed.' })

        if (oldPublicId)
            await cloudinary.uploader.destroy(oldPublicId, { resource_type: "image" })

        const newEntry = {
            imageURL: upload.secure_url,
            publicId: upload.public_id,
            postedAt: new Date(upload.created_at || Date.now())
        }

        const updatedUser = await User
            .findByIdAndUpdate(
                userId,
                { $set: { profilePic: newEntry } },
                { new: true, runValidators: true, select: '-password' },
            )
            .populate({
                path: 'defaultLocationId',
                select: 'locality area country'
            })
            .lean()

        if (!updatedUser)
            return res
                .status(404)
                .json({ message: 'User not found.' })

        return res
            .status(200)
            .json({
                _id: updatedUser._id,
                fullname: updatedUser.fullname,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio ?? null,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
                profilePic: updatedUser.profilePic?.imageURL ?? null,
                favs: updatedUser.favs ?? null,
                defaultLocationId: updatedUser.defaultLocationId?._id ?? null,
                defaultLocation: updatedUser.defaultLocationId
                    ? {
                        _id: updatedUser.defaultLocationId._id,
                        locality: updatedUser.defaultLocationId.locality,
                        area: updatedUser.defaultLocationId.area,
                        country: updatedUser.defaultLocationId.country
                    } : null
            })

    } catch (e) {
        console.log(`Error updating profile pic: ${e}`);
        return res
            .status(400)
            .json({ message: 'Internal Server Error updating profile picture.' })
    }
}

export const updateProfile = async (req, res) => {
    try {
        const userId = req.userId
        let { fullname, username, email, bio, location } = req.body

        if (!userId)
            return res
                .status(401)
                .json({ message: 'Unauthorized.' })

        const user = await User.findById(userId)
        if (!user)
            return res
                .status(400)
                .json({ message: 'User not found.' })

        const update = {}

        // normalize 
        if (fullname !== undefined)
            fullname = String(fullname).trim()
        if (username !== undefined)
            username = String(username).trim()
        if (email !== undefined)
            email = String(email).trim().toLowerCase()
        if (bio !== undefined)
            bio = String(bio).trim()

        if (fullname !== undefined)
            update.fullname = fullname

        if (username !== undefined) {
            if (username !== user.username) {
                const existingUsername = await User.findOne({
                    username: new RegExp(`^${username}$`, "i"),
                    _id: { $ne: userId },
                }).lean()
                if (existingUsername)
                    return res
                        .status(400)
                        .json({ message: "Username already taken." })

                update.username = username
            }
        }

        if (email !== undefined) {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            if (!isEmail)
                return res
                    .status(400)
                    .json({ message: "Not valid email." })

            const existingEmail = await User.findOne({
                email,
                _id: { $ne: userId }
            }).lean()

            if (existingEmail)
                return res
                    .status(400)
                    .json({ message: 'Email already used.' })

            update.email = email
        }

        if (bio !== undefined) {
            if (bio.length > 200)
                return res
                    .status(400)
                    .json({ message: 'Bio is too long. Max 200 characters.' });
            update.bio = bio
        }

        // update location only if all fields were set
        if (location !== undefined) {
            if (!location || typeof location !== 'object')
                return res
                    .status(400)
                    .json({ message: 'Invalid location payload.' })

            // normalize
            const locality = String(location.locality ?? '').trim()
            const area = String(location.area ?? '').trim()
            const country = String(location.country ?? '').trim()

            const missing = [];
            if (!locality)
                missing.push('locality')
            if (!area)
                missing.push('area')
            if (!country)
                missing.push('country')

            if (missing.length)
                return res
                    .status(400)
                    .json({ message: `Missing required location fields: ${missing.join(', ')}` })

            try {
                const locDoc = await resolveOrCreateLocation({ locality, area, country })
                update.defaultLocationId = locDoc._id
            } catch (e) {
                const msg = e?.message || 'Failed to geocode.'
                return res
                    .status(400)
                    .json({ message: msg })
            }
        }

        if (Object.keys(update).length === 0)
            return res
                .status(400)
                .json({ message: "No changes provided." })

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true, runValidators: true, select: '-password' }
        ).populate({
            path: 'defaultLocationId',
            select: 'locality area country'
        })

        if (!updatedUser)
            return res
                .status(400)
                .json({ message: 'Failed to update user.' })

        return res
            .status(200)
            .json({
                _id: updatedUser._id,
                fullname: updatedUser.fullname,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio ?? null,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
                profilePic: updatedUser.profilePic?.imageURL ?? null,
                favs: updatedUser.favs ?? null,
                defaultLocationId: updatedUser.defaultLocationId?._id ?? null,
                defaultLocation: updatedUser.defaultLocationId
                    ? {
                        _id: updatedUser.defaultLocationId._id,
                        locality: updatedUser.defaultLocationId.locality,
                        area: updatedUser.defaultLocationId.area,
                        country: updatedUser.defaultLocationId.country
                    } : null
            })

    } catch (e) {
        console.log(`Error updating profile: ${e}`)
        return res
            .status(500)
            .json({ message: 'Internal Server Error editing account.' })
    }
}

export const deleteProfile = async (req, res) => {
    try {
        const userId = req.userId

        if (!userId)
            return res
                .status(401)
                .json({ message: 'Unauthorized.' })

        const user = await User.findById(userId).lean()

        if (!user)
            return res
                .status(400)
                .json({ message: 'User not found.' })

        const profilePic = user.profilePic
        if (profilePic)
            await cloudinary.uploader.destroy(profilePic.publicId, { resource_type: "image" })

        for (const recipeId of user.favs)
            await Recipe.findByIdAndUpdate(recipeId, { $inc: { likeCount: -1 } })

        await User.deleteOne({ _id: userId })

        res.clearCookie('jwt', {
            httpOnly: true,
            sameSite: 'strict',
            secure: process.env.NODE_ENV !== 'development'
        })



        return res
            .status(204)
            .json({ message: 'Account Deleted!' })

    } catch (e) {
        console.log(`Error deleting profile: ${e}`);
        return res
            .status(400)
            .json({ message: 'Internal Server Error deleting profile.' })
    }
}

export const getProfile = async (req, res) => {
    try {
        const { username } = req.params

        if (!username)
            return res.status(400)
                .json({ message: 'Missing profile username' })

        const user = await User.findOne({ username })

        if (!user)
            return res.status(404)
                .json({ message: 'User not found' })

        return res
            .status(200)
            .json({
                _id: user._id,
                fullname: user.fullname,
                username: user.username,
                bio: user.bio ?? null,
                profilePic: user.profilePic?.imageURL ?? null
            })
    } catch (e) {
        console.log(`Error getting profile info: ${e}`);
        return res.status(400)
            .json({ message: 'Internal Server Error getting profile.' })
    }
}