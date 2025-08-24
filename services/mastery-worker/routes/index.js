const express = require('express');
const path = require('path');
const router = express.Router();

router.get('/', (req, res) => {
  const { region, nickname, tag } = req.query;
  if (region && nickname && tag) {
    return res.redirect(`/${region}/${encodeURIComponent(nickname)}-${tag}/overview`);
  }
  res.sendFile(path.join(__dirname, '..', 'web', 'index.html'));
});

module.exports = router;