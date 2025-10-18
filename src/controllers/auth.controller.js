import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { User } from "../models/auth.model.js";
import { generateToken } from '../lib/utils.js'

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
            return res.status(400)
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

        return res.status(201)
            .json({
                _id: newUser._id,
                fullname: newUser.fullname,
                username: newUser.username,
                email: newUser.email,
                bio: newUser.bio ?? null,
                createdAt: newUser.createdAt,
                updatedAt: newUser.updatedAt,
                profilePic: newUser.profilePic?.imageURL ?? null,
                location: newUser.location ?? null
            })

    } catch (e) {
        console.log(`Error signing up: ${e}`);
        return res.status(400)
            .json({ message: 'Internal Server Error creating account.' })
    }
}

export const signin = async (req, res) => {
    // unpack data
    const { identifier, password } = req.body

    try {
        // return if data is missing
        if (!identifier || !password)
            return res.status(400)
                .json({ message: 'Missing creadentials.' })

        // clean up just in case
        const login = String(identifier).trim();
        // determine what user used for auth
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);

        const user = await User.findOne(
            isEmail ? { email: login.toLowerCase() } : { username: login }
        )

        if (!user)
            return res.status(400)
                .json({ message: 'Invalid creadentials.' })

        // comparing input with db
        const isPassword = await bcrypt.compare(password, user.password)

        if (!isPassword)
            return res.status(400)
                .json({ message: 'Invalid creadentials.' })

        // giving jwt in cookies
        generateToken(user._id, res)

        return res.status(200)
            .json({
                _id: user._id,
                fullname: user.fullname,
                username: user.username,
                email: user.email,
                bio: user.bio ?? null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
                profilePic: user.profilePic?.imageURL ?? null,
                location: user.location ?? null
            })

    } catch (e) {
        console.log(`Error signing in: ${e}`);
        return res.status(400)
            .json({ message: 'Internal Server Error signing in.' })
    }
}

export const signout = async (req, res) => {
    try {
        // just removing session
        res.cookie('jwt', '', { maxAge: 0 })

        return res.status(200)
            .json({ message: 'Logged Out' })
    } catch (e) {
        console.log(`Error signing out: ${e}`);
        return res.status(400)
            .json({ message: 'Internal Server Error signing out.' })
    }
}

export const me = async (req, res) => {
    try {
        const user = await User.findById(req.userId)
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
                location: user.location ?? null
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

        const oldProfilePic = user.profilePic.publicId

        profilePic = profilePic.trim()
        const isDataUrl = profilePic.startsWith('data:')
        const uploadSource = isDataUrl ? profilePic : `data:image/jpeg;base64,${profilePic}`

        const upload = await cloudinary.uploader.upload(uploadSource, {
            folder: `local-bite/users/${userId}/profile`,
            overwrite: true
        })

        if (!upload?.secure_url)
            return res
                .status(502)
                .json({ message: 'Upload failed.' })

        if (oldProfilePic) 
            await cloudinary.uploader.destroy(oldProfilePic, { resource_type: "image" })

        const newEntry = {
            imageURL: upload.secure_url,
            publicId: upload.public_id,
            postedAt: new Date(upload.created_at || Date.now())
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: { profilePic: newEntry } },
            { new: true, runValidators: true, select: '-password' },
        ).lean()

        if (!updatedUser)
            return res
                .status(404)
                .json({ message: 'User not found.' })

        return res.status(200)
            .json({
                _id: updatedUser._id,
                fullname: updatedUser.fullname,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio ?? null,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
                profilePic: updatedUser.profilePic?.imageURL ?? null,
                location: updatedUser.location ?? null
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
        let { fullname, username, email, bio } = req.body

        if (!userId)
            return res.status(401)
                .json({ message: 'Unauthorized.' })

        const user = await User.findById(userId)
        if (!user)
            return res.status(400)
                .json({ message: 'User not found.' })

        const update = {}

        if (fullname !== undefined)
            update.fullname = fullname.trim()

        if (username !== undefined) {
            username = username.trim()

            if (username !== user.username) {
                const existingUsername = await User.findOne({
                    username: new RegExp(`^${username}$`, "i"),
                    _id: { $ne: userId },
                }).lean()
                if (existingUsername)
                    return res.status(400)
                        .json({ message: "Username already taken." })

                update.username = username
            }
        }

        if (email !== undefined) {
            email = email.trim().toLowerCase()

            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

            if (!isEmail)
                return res.status(400)
                    .json({ message: "Not valid email." })

            const existingEmail = await User.findOne({
                email: email,
                _id: { $ne: userId }
            }).lean()

            if (existingEmail)
                return res.status(400)
                    .json({ message: 'Email already used.' })

            update.email = email
        }

        if (bio !== undefined) {
            bio = bio.trim()

            if (bio.length > 200)
                return res.status(400)
                    .json({ message: 'Bio is too long. Max 200 characters.' })

            update.bio = bio
        }

        if (Object.keys(update).length === 0) {
            return res.status(400)
                .json({ message: "No changes provided." });
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { new: true, runValidators: true, select: '-password' }
        )

        if (!updatedUser)
            return res.status(400)
                .json({ message: 'Failed to update user.' })

        return res.status(200)
            .json({
                _id: updatedUser._id,
                fullname: updatedUser.fullname,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio ?? null,
                createdAt: updatedUser.createdAt,
                updatedAt: updatedUser.updatedAt,
                profilePic: updatedUser.profilePic?.imageURL ?? null,
                location: updatedUser.location ?? null
            })

    } catch (e) {
        console.log(`Error updating profile: ${e}`);
        return res.status(400)
            .json({ message: 'Internal Server Error editing account.' })
    }
}