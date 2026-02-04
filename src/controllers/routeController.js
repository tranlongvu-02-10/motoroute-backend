
const { geocodeAddress, isCoordinate } = require('../services/geocodingService');
const { getWeather } = require('../services/weatherService');
const { getJamRisk } = require('../services/trafficPredictionService');
const { calculateRouteMetrics, sortRoutesByScore } = require('../services/routeOptimizationService');
const axios = require('axios');

const optimizeRoute = async (req, res) => {
  let { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Cần start và end' });
  }

  try {
    // Geocoding
    let startCoord = start;
    let endCoord = end;
    let startAddress = start;
    let endAddress = end;

    if (!isCoordinate(start)) startCoord = await geocodeAddress(start);
    if (!isCoordinate(end)) endCoord = await geocodeAddress(end);

    // Directions API
    const directionsRes = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
      params: {
        origin: startCoord,
        destination: endCoord,
        key: process.env.GOOGLE_MAPS_API_KEY,
        mode: 'driving',
        alternatives: true,
        region: 'vn',
        departure_time: 'now',
      },
    });

    const data = directionsRes.data;
    if (data.status !== 'OK' || !data.routes?.length) {
      return res.status(400).json({ error: 'Không tìm thấy lộ trình', details: data });
    }

    const routes = data.routes;

    // Thời tiết
    const [lat, lon] = startCoord.split(',').map(Number);
    const weather = await getWeather(lat, lon);

    // Jam risk
    const jamRisk = getJamRisk(lat, lon, weather.impactPercentage);

    // Xử lý routes
    const processed = routes.map((route, index) => ({
      ...calculateRouteMetrics(route, jamRisk),
      routeIndex: index,
    }));

    const sorted = sortRoutesByScore(processed);
    const best = sorted[0];

    res.json({
      success: true,
      routes: sorted,
      bestRoute: best,
      currentJamRisk: `${jamRisk.toFixed(0)}%`,
      weather,
      startAddress,
      endAddress,
      startCoord,
      endCoord,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server', details: error.message });
  }
};

module.exports = { optimizeRoute };