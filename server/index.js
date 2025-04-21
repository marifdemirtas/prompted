const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const session = require('express-session');
const MongoStore = require('connect-mongo');

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 8000;

// MongoDB connection
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/prompted')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Configure middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(morgan('dev'));

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'prompted-session-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI || 'mongodb://localhost:27017/prompted',
    collectionName: 'sessions'
  }),
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax', // Use 'lax' for development
    secure: false, // Set to false for development so it works over HTTP
    path: '/'
  }
}));

// Import routes
const conversationRoutes = require('./routes/conversation');
const llmRoutes = require('./routes/llm');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');

// Import middleware
const { requireAuth } = require('./middleware/auth');

// Mount routes - auth routes are public
app.use('/api/auth', authRoutes);

// All other routes require authentication
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/conversations', requireAuth, conversationRoutes);
app.use('/api/llm', requireAuth, llmRoutes);

// Serve static assets from the React app
app.use(express.static(path.join(__dirname, '../client/build')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 