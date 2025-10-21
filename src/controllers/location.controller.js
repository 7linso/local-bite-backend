import 'dotenv/config'
import { resolveOrCreateLocation } from '../lib/location.js'
import { Location } from '../models/location.model.js'

export const getAllLoc = async (req, res) => {
    try {
        const locations = await Location.find().lean()
        if (!locations)
            return res.status(404)
                .json({ message: 'No locations found.' })

        return res.status(200)
            .json({
                count: locations.length,
                locations
            })
    } catch (e) {
        console.log('Error getting all locations.')
        return res.status(404)
            .json({ message: 'Internal Server Error getting locations.' })
    }
}

export const getAllLocCoords = async (req, res) => {
    try {
        const locations = await Location.find().lean()
        if (!locations)
            return res.status(404)
                .json({ message: 'No locations found.' })

        const coords = locations.map(loc => loc.point.coordinates)

        return res.status(200)
            .json({
                count: locations.length,
                coords: coords
            })
    } catch (e) {
        console.log('Error getting all locations.')
        return res.status(404)
            .json({ message: 'Internal Server Error getting locations.' })
    }
}