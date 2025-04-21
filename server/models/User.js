const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  allowedServices: {
    type: [String],
    default: ['gemini-direct', 'gemini-explanation', 'gemini-dialogue', 'gemini-scaffolding']
  },
  defaultService: {
    type: String,
    default: 'gemini-dialogue'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema); 