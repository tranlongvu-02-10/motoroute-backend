const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const routeRoutes = require('./routes/routes');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routeRoutes);

// Route test nhanh
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MotoRoute backend đang chạy!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server chạy tại http://localhost:${PORT}`);
});