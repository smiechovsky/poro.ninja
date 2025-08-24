const express = require('express');
const db = require('../db');

const router = express.Router();

// Toggle VIP for an account by region/nickname/tag
router.post('/:region/:user/vip-toggle', async (req, res, next) => {
  try {
    const { region, user } = req.params;
    const [nickname, tag] = user.split('-');
    if (!nickname || !tag) return res.status(400).json({ error: 'Bad request' });

    const { rows } = await db.query(
      'SELECT id, vip FROM AccountsToSync WHERE region=$1 AND nickname=$2 AND tag=$3',
      [region, nickname, tag]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Account not found' });

    const current = rows[0].vip === true;
    const updated = await db.query(
      `UPDATE AccountsToSync 
       SET vip=$1,
           vip_status_added_at = CASE WHEN $1 = TRUE THEN COALESCE(vip_status_added_at, NOW()) ELSE vip_status_added_at END
       WHERE id=$2 
       RETURNING vip, vip_status_added_at`,
      [!current, rows[0].id]
    );

    res.json({ vip: updated.rows[0].vip, vip_status_added_at: updated.rows[0].vip_status_added_at });
  } catch (err) {
    next(err);
  }
});

module.exports = router;


