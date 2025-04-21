/**
 * Database initialization script
 * Run this script to initialize the database with users from CSV file
 * Usage: node scripts/init-db.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parse/sync');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Function to read users from CSV file
function readUsersFromCSV() {
  const csvFilePath = path.join(__dirname, '../data/users.csv');
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  
  const records = csv.parse(fileContent, {
    columns: true,
    skip_empty_lines: true
  });

  return records.map(record => ({
    username: record.username,
    allowedServices: record.allowedServices.split(','),
    defaultService: record.defaultService
  }));
}

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
    
    // Read users from CSV file
    const users = readUsersFromCSV();
    console.log(`Found ${users.length} users in CSV file`);
    
    // For each user from CSV
    for (const userData of users) {      
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