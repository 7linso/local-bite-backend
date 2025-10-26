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

const RecipePicSchema = new mongoose.Schema(
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
            maxlength: 100
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
        instructions: {
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
        dishTypes: {
            type: [String],
            default: [],
            enum: ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Vegan', 'BBQ', 'Soup', 'Salad', 'Drink'],
            index: true
        },
        recipePic: {
            type: RecipePicSchema,
            default: undefined
        },

        locationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Location',
            required: true,
            index: true,
        },
        point: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
                required: true
            },
            coordinates: {
                type: [Number],
                required: true,
                validate: v => Array.isArray(v) && v.length === 2
            }
        },

        locationSnapshot: {
            locality: {
                type: String,
                trim: true,
                index: true
            },
            area: {
                type: String,
                trim: true,
                index: true
            },
            country: {
                type: String,
                trim: true,
                index: true
            }
        },


    },
    { timestamps: true }
);

RecipeSchema.index({
    point: '2dsphere'
})
RecipeSchema.index({
    'locationSnapshot.country': 1,
    'locationSnapshot.area': 1,
    'locationSnapshot.locality': 1
})
RecipeSchema.index({ authorId: 1 })
RecipeSchema.index({ createdAt: -1, _id: -1 })

RecipeSchema.index({
    title: 'text',
    description: 'text',
    'ingredients.ingredient': 'text'
})

export const Recipe = mongoose.model('Recipe', RecipeSchema);
