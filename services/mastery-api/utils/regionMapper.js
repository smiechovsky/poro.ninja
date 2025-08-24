/**
 * Maps League of Legends regions to continents for API calls
 */
const regionToContinent = (region) => {
  const regionMap = {
    'eun1': 'europe',
    'euw1': 'europe',
    'tr1': 'europe',
    'ru': 'europe',
    'na1': 'americas',
    'br1': 'americas',
    'la1': 'americas',
    'la2': 'americas',
    'kr': 'asia',
    'jp1': 'asia',
    'oc1': 'sea',
    'ph2': 'sea',
    'sg2': 'sea',
    'th2': 'sea',
    'tw2': 'sea',
    'vn2': 'sea'
  };
  
  return regionMap[region.toLowerCase()] || 'europe';
};

module.exports = { regionToContinent }; 