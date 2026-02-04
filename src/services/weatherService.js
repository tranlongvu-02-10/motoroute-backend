const axios = require('axios');

const getWeather = async (lat, lon) => {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat,
        lon,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'vi',
      },
    });

    const data = response.data;
    const main = data.weather?.[0]?.main?.toLowerCase() || '';
    const description = data.weather?.[0]?.description || 'Không rõ';

    let impact = 0;
    let isRaining = false;

    if (main.includes('rain') || main.includes('drizzle') || main.includes('thunderstorm')) {
      isRaining = true;
      impact = 40;
    }

    return {
      isRaining,
      description,
      temperature: data.main?.temp ? `${data.main.temp}°C` : 'N/A',
      impactPercentage: impact,
    };
  } catch (error) {
    console.warn('Weather error:', error.message);
    return {
      isRaining: false,
      description: 'Không lấy được dữ liệu',
      temperature: 'N/A',
      impactPercentage: 0,
    };
  }
};

module.exports = { getWeather };