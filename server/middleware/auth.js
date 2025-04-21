/**
 * Authentication middleware to protect routes
 */
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  next();
}

module.exports = {
  requireAuth
};