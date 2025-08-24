const express = require('express');
const db = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  const q = req.query.query || '';
  console.log(`[SEARCH] Query: "${q}", length: ${q.length}`);
  
  if (q.length < 3) {
    console.log(`[SEARCH] Query too short, returning empty array`);
    return res.json([]);
  }

  try {
    const { rows } = await db.query(
      `SELECT DISTINCT nickname, tag, region FROM AccountsToSync
       WHERE LOWER(nickname) LIKE LOWER($1) ORDER BY nickname ASC LIMIT 5`,
      [q + '%']
    );

    console.log(`[SEARCH] Found ${rows.length} results for query "${q}"`);

    const map = {
      br1: 'BR', euw1: 'EUW', eun1: 'EUNE', jp1: 'JP', kr: 'KR', la1: 'LAN',
      la2: 'LAS', na1: 'NA', oc1: 'OCE', ru: 'RU', tr1: 'TR', ph2: 'PH',
      sg2: 'SG', th2: 'TH', tw2: 'TW', vn2: 'VN'
    };

    const result = rows.map(r => ({
      nickname: r.nickname,
      tag: r.tag,
      region: map[r.region] || r.region,
      regionCode: r.region,
    }));

    console.log(`[SEARCH] Returning ${result.length} results`);
    res.json(result);
  } catch (error) {
    console.error(`[SEARCH] Error:`, error);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;