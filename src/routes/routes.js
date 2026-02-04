const express = require('express');
const router = express.Router();

const { optimizeRoute } = require('../controllers/routeController');
const { saveRoute, getHistory } = require('../controllers/historyController');

// === API chính ===
router.post('/optimize-route', optimizeRoute);
// === Lịch sử lộ trình ===
router.post('/history', saveRoute);     // Lưu lộ trình
router.get('/history', getHistory);     // Lấy danh sách lịch sử

// === Route test & debug ===
router.get('/test', (req, res) => {
  res.json({ 
    message: 'API route hoạt động tốt!',
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// === Export router ===
module.exports = router;