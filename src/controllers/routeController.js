const axios = require('axios');

// Hàm kiểm tra input là tọa độ "lat,lng" hay text
const isCoordinate = (str) => {
  if (typeof str !== 'string') return false;
  const parts = str.split(',');
  return parts.length === 2 && !isNaN(parseFloat(parts[0].trim())) && !isNaN(parseFloat(parts[1].trim()));
};

// Hàm chuyển địa chỉ text thành tọa độ (Geocoding)
const geocodeAddress = async (address) => {
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address,
        key: process.env.GOOGLE_MAPS_API_KEY,
        region: 'vn',
        language: 'vi',
      },
    });

    const data = response.data;
    if (data.status !== 'OK' || !data.results?.length) {
      throw new Error(`Không tìm thấy địa chỉ "${address}" (status: ${data.status})`);
    }

    const location = data.results[0].geometry.location;
    return `${location.lat},${location.lng}`;
  } catch (error) {
    console.error('Lỗi Geocoding:', error.message);
    throw new Error(`Không thể tìm địa chỉ: ${error.message}`);
  }
};

// Hàm lấy dữ liệu bụi PM2.5 từ IQAir
const getAirQuality = async (lat, lon) => {
  try {
    const response = await axios.get('https://api.airvisual.com/v2/nearest_city', {
      params: {
        lat,
        lon,
        key: process.env.IQAIR_API_KEY,
      },
    });

    const data = response.data.data;
    const pollution = data.current?.pollution;

    if (!pollution || pollution.aqius === undefined) {
      throw new Error('Không có dữ liệu ô nhiễm');
    }

    const pm25 = pollution.aqius; // AQI US

    let level = 'Không rõ';
    let impact = 0; // % trừ điểm trong score

    if (pm25 <= 50) {
      level = 'Tốt';
      impact = 0;
    } else if (pm25 <= 100) {
      level = 'Trung bình';
      impact = 10;
    } else if (pm25 <= 150) {
      level = 'Không lành mạnh cho nhóm nhạy cảm';
      impact = 25;
    } else if (pm25 <= 200) {
      level = 'Không lành mạnh';
      impact = 40;
    } else {
      level = 'Rất không lành mạnh / Kém';
      impact = 60;
    }

    return {
      pm25,
      level,
      impactPercentage: impact,
      city: data.city || 'N/A',
      station: data.location?.name || 'N/A',
    };
  } catch (error) {
    console.warn('Lỗi lấy PM2.5 từ IQAir:', error.message);
    return {
      pm25: null,
      level: 'Không lấy được dữ liệu',
      impactPercentage: 0,
      city: 'N/A',
      station: 'N/A',
    };
  }
};

const optimizeRoute = async (req, res) => {
  let { start, end } = req.body;

  if (!start || !end) {
    return res.status(400).json({
      error: 'Cần cung cấp start và end (tọa độ dạng lat,lng hoặc địa chỉ text)'
    });
  }

  try {
    // 1. Geocoding nếu cần
    let startCoord = start;
    let endCoord = end;
    let startAddress = start;
    let endAddress = end;

    if (!isCoordinate(start)) {
      startCoord = await geocodeAddress(start);
      startAddress = start;
    }

    if (!isCoordinate(end)) {
      endCoord = await geocodeAddress(end);
      endAddress = end;
    }

    // 2. Gọi Google Maps Directions API
    const directionsResponse = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
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

    const directionsData = directionsResponse.data;

    if (directionsData.status !== 'OK') {
      return res.status(400).json({
        error: 'Google Maps trả về lỗi',
        googleStatus: directionsData.status,
        googleMessage: directionsData.error_message || 'Không có thông tin chi tiết'
      });
    }

    const routes = directionsData.routes;

    if (!routes || routes.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lộ trình nào' });
    }

    // 3. Lấy thời tiết (OpenWeatherMap) - dùng tọa độ start
    let weatherInfo = {
      isRaining: false,
      description: 'Không lấy được dữ liệu',
      temperature: 'N/A',
      impactPercentage: 0,
    };

    const [startLat, startLon] = startCoord.split(',').map(Number);

    try {
      const weatherResponse = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat: startLat,
          lon: startLon,
          appid: process.env.OPENWEATHER_API_KEY,
          units: 'metric',
          lang: 'vi',
        },
      });

      const weatherData = weatherResponse.data;
      const mainWeather = weatherData.weather?.[0]?.main?.toLowerCase() || '';
      weatherInfo.description = weatherData.weather?.[0]?.description || 'Không rõ';
      weatherInfo.temperature = weatherData.main?.temp ? `${weatherData.main.temp}°C` : 'N/A';

      if (mainWeather.includes('rain') || mainWeather.includes('drizzle') || mainWeather.includes('thunderstorm')) {
        weatherInfo.isRaining = true;
        weatherInfo.impactPercentage = 40;
      }
    } catch (weatherErr) {
      console.warn('Không lấy được thời tiết:', weatherErr.message);
    }

    // 4. Lấy bụi PM2.5 (IQAir)
    const airQuality = await getAirQuality(startLat, startLon);

    // 5. Tính dự đoán kẹt xe
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    let jamRiskPercentage = 0;

    if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
      jamRiskPercentage += 50;
    }

    if (dayOfWeek === 0 || dayOfWeek === 6) {
      jamRiskPercentage -= 20;
    }

    jamRiskPercentage += weatherInfo.impactPercentage;
    jamRiskPercentage = Math.max(0, Math.min(90, jamRiskPercentage));

    // 6. Xử lý và tối ưu các lộ trình
    const processedRoutes = routes.map((route, index) => {
      const leg = route.legs[0];

      const baseDurationMinutes = leg.duration.value / 60;
      const extraTimeMinutes = baseDurationMinutes * (jamRiskPercentage / 100);
      const predictedDurationMinutes = Math.round(baseDurationMinutes + extraTimeMinutes);

      const distanceKm = leg.distance.value / 1000;
      const fuelConsumption = 2.2;
      const fuelUsedLiters = (distanceKm * fuelConsumption) / 100;

      // Score tổng: thời gian + kẹt + bụi
      const score = Math.round(
        predictedDurationMinutes +
        jamRiskPercentage * 0.5 +
        airQuality.impactPercentage * 0.4
      );

      return {
        routeIndex: index,
        summary: route.summary || 'Lộ trình xe máy',
        distance: leg.distance.text,
        baseDuration: leg.duration.text,
        predictedDuration: `${predictedDurationMinutes} phút (dự đoán)`,
        jamRisk: `${jamRiskPercentage.toFixed(0)}%`,
        fuelUsed: `${fuelUsedLiters.toFixed(2)} lít`,
        dustLevel: airQuality.level,
        dustPM25: airQuality.pm25,
        dustCity: airQuality.city,
        dustStation: airQuality.station,
        polyline: route.overview_polyline.points,
        score,
      };
    });

    // Sắp xếp theo score tốt nhất (thấp nhất)
    processedRoutes.sort((a, b) => a.score - b.score);

    const bestRoute = processedRoutes[0];

    // Response hoàn chỉnh
    res.json({
      success: true,
      routes: processedRoutes,
      bestRoute,
      currentJamRisk: `${jamRiskPercentage.toFixed(0)}%`,
      weather: weatherInfo,
      airQuality: {
        pm25: airQuality.pm25,
        level: airQuality.level,
        city: airQuality.city,
        station: airQuality.station,
      },
      startAddress,
      endAddress,
      startCoord,
      endCoord,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Lỗi trong optimizeRoute:', error.message);
    if (error.response) console.error('Response data:', error.response.data);

    res.status(500).json({
      error: 'Lỗi server khi xử lý yêu cầu',
      details: error.message,
    });
  }
};

module.exports = { optimizeRoute };