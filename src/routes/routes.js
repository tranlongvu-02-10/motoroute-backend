const express = require('express');
const router = express.Router();
const { optimizeRoute } = require('../controllers/routeController');

// Endpoint chính: tối ưu lộ trình
router.post('/optimize-route', optimizeRoute);

// Route test
router.get('/test', (req, res) => {
  res.json({ message: 'API route hoạt động tốt!' });
});

module.exports = router;