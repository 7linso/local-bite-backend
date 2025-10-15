import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { User } from "../models/auth.model.js";
import { generateToken } from '../lib/utils.js'

export const signup = async (req, res) => {
    // unpack data
    const { fullname, username, email, password } = req.body

    try {
        if (!fullname || !username || !email || !password)
            return res
                .status(400)
                .json({ message: 'All fields are required.' })

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
        res.status(400).json({ message: 'Internal Server Error creating account.' })
    }
}

export const signin = () => { }

export const signout = () => { }
