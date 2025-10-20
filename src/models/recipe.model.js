import mongoose from 'mongoose';

const IngredientSchema = new mongoose.Schema(
    {
        ingredient: {
            type: String,
            trim: true,
            maxlength: 100,
            required: true
        },
        amount: {
            type: Number,
            min: 0
        },
        measure: {
            type: String,
            trim: true,
            maxlength: 20
        },
    },
    { _id: false }
);

const RecipeSchema = new mongoose.Schema(
    {
        authorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500
        },
        ingredients: {
            type: [IngredientSchema],
            default: [],
            validate: {
                validator: (arr) => Array.isArray(arr) && arr.length > 0,
                message: 'At least one ingredient is required.',
            },
        },
        steps: {
            type: [{
                type: String,
                trim: true,
                maxlength: 200
            }],
            default: [],
            validate: {
                validator: (arr) => Array.isArray(arr) && arr.length > 0,
                message: 'At least one step is required.',
            },
        },

        locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location',
            required: true,
            index: true,
        },
        country_code: {
            type: String,
            required: true,
            uppercase: true,
            index: true,
            minlength: 2,
            maxlength: 2,
        },
        point: {
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: {
                type: [Number], // [lng, lat]
                required: true,
                validate: {
                    validator: (v) => Array.isArray(v) && v.length === 2,
                    message: 'point.coordinates must be [lng, lat]',
                },
            },
        },
    },
    { timestamps: true }
);

RecipeSchema.index({ point: '2dsphere' })
RecipeSchema.index(
    { authorId: 1, title: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } }
);

export const Recipe = mongoose.model('Recipe', RecipeSchema);
