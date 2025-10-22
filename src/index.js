import express from 'express'
import 'dotenv/config'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRoutes from './routes/auth.router.js'
import locationRoutes from './routes/location.router.js'
import recipeRoutes from './routes/recipe.router.js'
import { connectDB } from './lib/db.js'

const PORT = Number(process.env.PORT) || 3001;
const BASIC_URL = process.env.BASIC_URL

// start app
const app = express()

// middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use(cookieParser())

app.use(
    cors({
        origin: 'http://localhost:5173',
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
)

// routes
app.get('/', (req, res) => res.json({ message: 'API is running 🚀' }));

app.use(`${BASIC_URL}/auth`, authRoutes)
app.use(`${BASIC_URL}/loc`, locationRoutes)
app.use(`${BASIC_URL}/recipes`, recipeRoutes)

// connection
app.listen((PORT), () => {
    console.log(`server running on PORT ${PORT}`)
    connectDB()
})

process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
});
