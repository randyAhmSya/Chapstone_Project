'use strict'

require('dotenv').config()

const express   = require('express')
const cors      = require('cors')
const helmet    = require('helmet')
const rateLimit = require('express-rate-limit')

const app = express()

app.use(helmet())
app.use(cors({ origin: '*', credentials: true }))

// Rate limit sangat longgar saat test agar tidak mengganggu
app.use('/api/', rateLimit({
  windowMs: 1000,
  limit:    9999,
}))

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/api',       require('@src/routes/health'))
app.use('/api/auth',  require('@src/routes/auth'))
app.use('/api/jobs',  require('@src/routes/jobs'))
app.use('/api/cv',    require('@src/routes/cv'))
app.use('/api/users', require('@src/routes/users'))
app.use('/api/match', require('@src/routes/match'))

app.use((req, res) => {
  res.status(404).json({ error: `Endpoint ${req.method} ${req.path} tidak ditemukan` })
})

app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500
  res.status(status).json({ error: err.message || 'Internal server error' })
})

module.exports = app