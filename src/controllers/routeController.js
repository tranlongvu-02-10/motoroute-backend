const axios = require('axios');

const optimizeRoute = async (req, res) => {
  const { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ 
      error: 'Cần cung cấp start và end (tọa độ dạng lat,lng hoặc địa chỉ)' 
    });
  }

  try {
    // Gọi Google Maps Directions API
    const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: start,
        destination: end,
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving',           // xe máy cũng dùng driving ở VN
        alternatives: true,
        region: 'vn',
        departure_time: 'now',     // dùng thời gian hiện tại để lấy traffic realtime
      },
    });

    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(400).json({ 
        error: 'Google Maps trả về lỗi', 
        googleStatus: data.status,
        googleMessage: data.error_message || 'Không có thông tin chi tiết'
      });
    }

    const routes = data.routes;

    if (!routes || routes.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lộ trình nào' });
    }

    // Lấy thời gian hiện tại để dự đoán kẹt xe
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = CN, 1 = Thứ 2, ..., 6 = Thứ 7

    // Quy tắc dự đoán kẹt xe (có thể cải tiến sau)
    let jamRiskPercentage = 0;

    // Giờ cao điểm TP.HCM/Hà Nội
    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      jamRiskPercentage += 50; // tăng 50% thời gian
    }

    // Cuối tuần giảm rủi ro
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      jamRiskPercentage -= 20;
    }

    // Giới hạn min/max
    jamRiskPercentage = Math.max(0, Math.min(80, jamRiskPercentage));

    // Xử lý các lộ trình
    const processedRoutes = routes.map((route, index) => {
      const leg = route.legs[0];

      // Thời gian cơ bản từ Google (thường đã có traffic realtime)
      const baseDurationText = leg.duration.text; // ví dụ: "25 mins"
      const baseDurationMinutes = leg.duration.value / 60; // giây -> phút

      // Dự đoán thời gian thực tế (thêm phần kẹt xe)
      const extraTimeMinutes = baseDurationMinutes * (jamRiskPercentage / 100);
      const predictedDurationMinutes = Math.round(baseDurationMinutes + extraTimeMinutes);
      const predictedDurationText = `${predictedDurationMinutes} phút (dự đoán)`;

      // Ước tính xăng (giả sử xe máy tiêu thụ 2.0 - 2.5 lít/100km)
      const distanceKm = leg.distance.value / 1000;
      const fuelConsumption = 2.2; // lít/100km (trung bình xe Wave/Sirius)
      const fuelUsedLiters = (distanceKm * fuelConsumption) / 100;
      const fuelUsedText = fuelUsedLiters.toFixed(2) + ' lít';

      // Điểm số lộ trình (càng thấp càng tốt: thời gian + rủi ro kẹt)
      const score = Math.round(predictedDurationMinutes + jamRiskPercentage * 0.5);

      return {
        routeIndex: index,
        summary: route.summary || 'Lộ trình xe máy',
        distance: leg.distance.text,
        baseDuration: baseDurationText,
        predictedDuration: predictedDurationText,
        predictedDurationMinutes,
        jamRisk: jamRiskPercentage + '%',
        fuelUsed: fuelUsedText,
        polyline: route.overview_polyline.points,
        score: score, // dùng để sắp xếp lộ trình tốt nhất
      };
    });

    // Sắp xếp lộ trình theo score thấp nhất (tốt nhất)
    processedRoutes.sort((a, b) => a.score - b.score);

    // Lộ trình tốt nhất
    const bestRoute = processedRoutes[0];

    res.json({
      success: true,
      routes: processedRoutes,
      bestRoute,
      currentJamRisk: jamRiskPercentage + '%',
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Lỗi khi gọi Google Maps Directions API:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Google Response:', error.response.data);
    }

    res.status(500).json({
      error: 'Lỗi server khi lấy lộ trình',
      details: error.message,
      googleError: error.response ? error.response.data : null,
    });
  }
};

module.exports = { optimizeRoute };