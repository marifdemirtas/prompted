const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Login route (simple username-based auth)
router.post('/login', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    // Find user by username
    const user = await User.findOne({ username: username.trim() });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found. Please enter a valid username.' });
    }
    
    // Set session data
    req.session.userId = user._id;
    req.session.username = user.username;
    
    // Return user data
    res.json({
      id: user._id,
      username: user.username,
      allowedServices: user.allowedServices,
      defaultService: user.defaultService
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
});

// Logout route
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ message: 'Error during logout', error: err.message });
    }
    
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const user = await User.findById(req.session.userId);
    
    if (!user) {
      // Clear invalid session
      req.session.destroy();
      return res.status(401).json({ message: 'User not found' });
    }
    
    res.json({
      id: user._id,
      username: user.username,
      allowedServices: user.allowedServices,
      defaultService: user.defaultService
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ message: 'Error fetching user data', error: error.message });
  }
});

module.exports = router; 