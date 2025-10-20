import mongoose from 'mongoose';

const LocationSchema = new mongoose.Schema(
    {
        // normalized key to dedupe
        key: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        locality: {
            type: String,
            trim: true,
            required: true
        },
        area: {
            type: String,
            trim: true,
            default: ''
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
            required: true,
            index: true,
        },
        point: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number], // [lng, lat]
                required: true,
                validate: {
                    validator: v => Array.isArray(v) && v.length === 2,
                    message: 'point.coordinates must be [lng, lat]',
                },
            },
        },
        provider: {
            name: {
                type: String,
                default: 'maptiler'
            },
            raw: {
                type: mongoose.Schema.Types.Mixed
            },
        },
    },
    { timestamps: true }
);

function normalize(s) {
    return String(s ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

LocationSchema.index({ point: '2dsphere' });
LocationSchema.index({ country_code: 1, area: 1, locality: 1 });

LocationSchema.pre('validate', function (next) {
    if (
        !this.key ||
        this.isModified('locality') ||
        this.isModified('area') ||
        this.isModified('country_code')
    ) {
        const locality = normalize(this.locality);
        const area = normalize(this.area || '');
        const code = normalize(this.country_code);

        this.key = [locality, area, code].join('|');
    }

    next();
});

export const Location = mongoose.model('Location', LocationSchema);
