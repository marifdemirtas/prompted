/**
 * Database initialization script
 * Run this script to initialize the database with a default admin user
 * Usage: node scripts/init-db.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Default users to create
const defaultUsers = [
  {
    username: 'admin',
    allowedServices: ['gemini-direct', 'gemini-explanation', 'gemini-dialogue', 'gemini-scaffolding'],
    defaultService: 'gemini-dialogue'
  },
  {
    username: 'student1',
    allowedServices: ['gemini-dialogue'],
    defaultService: 'gemini-dialogue'
  },
  {
    username: 'student2',
    allowedServices: ['gemini-explanation'],
    defaultService: 'gemini-explanation'
  }
];

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/prompted')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Function to create users
async function createUsers() {
  try {
    // First, remove all existing users
    console.log('Removing all existing users...');
    await User.deleteMany({});
    console.log('All users removed');
    
    // For each default user
    for (const userData of defaultUsers) {      
      // Create new user
      const newUser = new User(userData);
      await newUser.save();
      
      console.log(`Created user '${userData.username}'`);
    }
    
    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    // Close MongoDB connection
    mongoose.connection.close();
  }
}

// Run the script
createUsers(); 