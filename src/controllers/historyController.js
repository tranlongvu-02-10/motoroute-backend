const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '../data/history.json');

// Đọc lịch sử từ file
const readHistory = () => {
  try {
    if (!fs.existsSync(HISTORY_FILE)) {
      fs.writeFileSync(HISTORY_FILE, JSON.stringify([]));
    }
    const data = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Lỗi đọc history file:', err);
    return [];
  }
};

// Ghi lịch sử vào file
const writeHistory = (history) => {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error('Lỗi ghi history file:', err);
  }
};

// Lưu lộ trình mới
const saveRoute = (req, res) => {
  const routeData = req.body;

  // Kiểm tra dữ liệu 
  if (!routeData.startAddress || !routeData.endAddress || !routeData.bestRoute) {
    return res.status(400).json({ error: 'Thiếu thông tin lộ trình cần lưu' });
  }

  const history = readHistory();

  const newEntry = {
    id: Date.now().toString(),
    ...routeData,
    timestamp: new Date().toISOString(),
  };

  history.push(newEntry);
  writeHistory(history);

  res.json({
    success: true,
    message: 'Lộ trình đã được lưu vào lịch sử',
    savedRoute: newEntry,
  });
};

// Lấy tất cả lịch sử
const getHistory = (req, res) => {
  const history = readHistory();
  res.json({
    success: true,
    history,
    count: history.length,
  });
};

module.exports = { saveRoute, getHistory };