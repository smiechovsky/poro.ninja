const axios = require('axios');
const db = require('../db');
const { 
  logChampionsUpdateStart, 
  logChampionsUpdateVersion, 
  logChampionsUpdateSuccess, 
  logChampionsUpdateComplete 
} = require('../debugger/api');

module.exports = async function updateChampions() {
  logChampionsUpdateStart();
  
  const version = process.env.DDRAGON_Version;
  if (!version) throw new Error('DDRAGON_Version not set');
  logChampionsUpdateVersion(version);

  const url = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;
  const data = (await axios.get(url)).data.data;
  logChampionsUpdateSuccess(Object.keys(data).length);

  const query = `
    INSERT INTO Champions(id, name, image_url)
    VALUES($1,$2,$3)
    ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, image_url=EXCLUDED.image_url;`;

  for (const champ of Object.values(data)) {
    const id = parseInt(champ.key, 10);
    const icon = `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${champ.id}.png`;
    await db.query(query, [id, champ.name, icon]);
  }

  logChampionsUpdateComplete();
};