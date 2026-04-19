const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  // Get token from header or authorization bearer
  const token = req.header('x-auth-token') ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  // Check if not token
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'], // Enforce algorithm
      maxAge: '5d' // Token expiry check
    });
    req.admin = decoded.admin;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ msg: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ msg: 'Invalid token.' });
    }
    res.status(401).json({ msg: 'Token verification failed.' });
  }
};
