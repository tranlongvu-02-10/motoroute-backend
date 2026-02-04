const getJamRisk = (lat, lon, weatherImpact = 0) => {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay();

  let risk = 0;

  // Giờ cao điểm
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 19)) {
    risk += 50;
  }

  // Cuối tuần
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    risk -= 20;
  }

  risk += weatherImpact;
  return Math.max(0, Math.min(90, risk));
};

module.exports = { getJamRisk };