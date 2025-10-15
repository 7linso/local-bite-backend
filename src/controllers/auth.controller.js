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

        res.status(201)
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
        res.status(400)
            .json({ message: 'Internal Server Error creating account.' })
    }
}

export const signin = async (req, res) => {
    // unpack data
    const { identifier, password } = req.body

    try {
        // return if data is missing
        if (!identifier || !password)
            res.status(400)
                .json({ message: 'Missing creadentials.' })

        // clean up just in case
        const login = String(identifier).trim();
        // determine what user used for auth
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);

        const user = await User.findOne(
            isEmail ? { email: login.toLowerCase() } : { username: login }
        )

        if (!user)
            res.status(400)
                .json({ message: 'Invalid creadentials.' })

        // comparing input with db
        const isPassword = await bcrypt.compare(password, user.password)

        if (!isPassword)
            res.status(400)
                .json({ message: 'Invalid creadentials.' })

        // giving jwt in cookies
        generateToken(user._id, res)

        res.status(200)
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
        res.status(400)
            .json({ message: 'Internal Server Error signing in.' })
    }
}

export const signout = async (req, res) => {
    try {
        // just removing session
        res.cookie('jwt', '', { maxAge: 0 })

        res.status(200)
            .json({ message: 'Logged Out' })
    } catch (e) {
        console.log(`Error signing out: ${e}`);
        res.status(400)
            .json({ message: 'Internal Server Error signing out.' })
    }
}
