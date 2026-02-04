const axios = require('axios');

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
      throw new Error(`Không tìm thấy địa chỉ "${address}"`);
    }

    const location = data.results[0].geometry.location;
    return `${location.lat},${location.lng}`;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw error;
  }
};

const isCoordinate = (str) => {
  if (typeof str !== 'string') return false;
  const parts = str.split(',');
  return parts.length === 2 && !isNaN(parseFloat(parts[0].trim())) && !isNaN(parseFloat(parts[1].trim()));
};

module.exports = { geocodeAddress, isCoordinate };