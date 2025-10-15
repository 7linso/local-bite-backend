import mongoose from 'mongoose'
import 'dotenv/config'

export const connectDB = async() => {
    try {
        const connection = await mongoose.connect(process.env.MONGODB_URI)

        console.log(`Connected to db: ${connection.connection.host}`)
    } catch(e) {
        console.log(`Error connecting to db: ${e}`)
    }
}