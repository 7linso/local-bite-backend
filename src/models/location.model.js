import mongoose from 'mongoose'

export const LocationSchema = new mongoose.Schema({
    locality: {
        type: String,
        trim: true,
        required: true
    },
    area: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true,
        required: true
    },
    country_code: {
        type: String,
        trim: true,
        uppercase: true,
        match: /^[A-Za-z]{2}$/,
        required: true
    },
    formatted: { type: String, trim: true },

    point: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [lng, lat]
            required: true,
            validate: v => v.length === 2
        }
    }
}, { _id: false });

LocationSchema.index({ point: '2dsphere' });