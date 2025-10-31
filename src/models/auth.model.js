import mongoose from 'mongoose';

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
        },
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema(
    {
        fullname: {
            type: String,
            required: true,
            trim: true
        },
        username: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },
        password: {
            type: String,
            required: true,
            minlength: 8,
            trim: true
        },
        bio: {
            type: String,
            maxlength: 200,
            trim: true
        },
        profilePic: {
            type: ProfilePicSchema,
            default: undefined
        },

        favs: {
            type: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Recipe'
            }],
            default: [],
        },
        defaultLocationId: {
            type: mongoose.Schema.Types.ObjectId, ref: 'Location',
            default: null
        },
    },
    { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
