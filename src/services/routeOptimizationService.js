const calculateRouteMetrics = (route, jamRiskPercentage) => {
  const leg = route.legs[0];

  const baseDurationMinutes = leg.duration.value / 60;
  const extraTimeMinutes = baseDurationMinutes * (jamRiskPercentage / 100);
  const predictedDurationMinutes = Math.round(baseDurationMinutes + extraTimeMinutes);

  const distanceKm = leg.distance.value / 1000;
  const fuelConsumption = 2.2;
  const fuelUsedLiters = (distanceKm * fuelConsumption) / 100;

  const score = Math.round(predictedDurationMinutes + jamRiskPercentage * 0.5);

  return {
    routeIndex: null, // sẽ gán sau
    summary: route.summary || 'Lộ trình xe máy',
    distance: leg.distance.text,
    baseDuration: leg.duration.text,
    predictedDuration: `${predictedDurationMinutes} phút (dự đoán)`,
    predictedDurationMinutes,
    jamRisk: `${jamRiskPercentage.toFixed(0)}%`,
    fuelUsed: `${fuelUsedLiters.toFixed(2)} lít`,
    polyline: route.overview_polyline.points,
    score,
  };
};

const sortRoutesByScore = (processedRoutes) => {
  return processedRoutes.sort((a, b) => a.score - b.score);
};

module.exports = { calculateRouteMetrics, sortRoutesByScore };