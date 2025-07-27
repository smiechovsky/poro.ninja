const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const q = req.query.query || '';
  if (q.length < 3) return res.json([]);

  const { rows } = await db.query(
    `SELECT DISTINCT nickname, tag, region FROM AccountsToSync
     WHERE LOWER(nickname) LIKE LOWER($1) ORDER BY nickname ASC LIMIT 10`,
    [q + '%']
  );

  const map = {
    br1: 'BR', euw1: 'EUW', eun1: 'EUNE', jp1: 'JP', kr: 'KR', la1: 'LAN',
    la2: 'LAS', na1: 'NA', oc1: 'OCE', ru: 'RU', tr1: 'TR', ph2: 'PH',
    sg2: 'SG', th2: 'TH', tw2: 'TW', vn2: 'VN'
  };

  res.json(rows.map(r => ({
    nickname: r.nickname,
    tag: r.tag,
    region: map[r.region] || r.region,
    regionCode: r.region,
  })));
});

module.exports = router;