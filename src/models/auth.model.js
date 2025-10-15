import mongoose from 'mongoose'
import { LocationSchema } from './location.model.js'

const ProfilePicSchema = new mongoose.Schema(
    {
        imageURL: {
            type: String,
            required: true
        },
        publicId: {
            type: String,
            required: true
        },
        postedAt: {
            type: Date,
            default: Date.now
        }
    },
    { _id: false }
)

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true
        },
        fullname: {
            type: String,
            required: true
        },
        username: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true,
            minLength: 8,
        },
        profilePic: {
            type: ProfilePicSchema,
            default: undefined
        },
        bio: {
            type: String,
            maxLength: 200
        },
        location: {
            type: LocationSchema,
        }
    },
    { timestamps: true }
)

export const User = mongoose.model('User', UserSchema)