const map = {
    br1: 'BR',
    euw1: 'EUW',
    eun1: 'EUNE',
    jp1: 'JP',
    kr: 'KR',
    la1: 'LAN',
    la2: 'LAS',
    na1: 'NA',
    oc1: 'OCE',
    ru: 'RU',
    tr1: 'TR',
    ph2: 'PH',
    sg2: 'SG',
    th2: 'TH',
    tw2: 'TW',
    vn2: 'VN',
  };
  
  function toName(code) {
    return map[code] || code;
  }
  
  function continent(region) {
    if(['eun1','euw1','tr1','ru'].includes(region)) return 'europe';
    if(['na1','la1','la2'].includes(region)) return 'americas';
    return 'asia';
  }
  
  module.exports = { map, toName, continent };