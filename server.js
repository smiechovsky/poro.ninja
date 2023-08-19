const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const apiKey = 'RGAPI-58910609-66ea-47dd-8da5-6c5b8e492bb5';

app.use(express.static('public'));
app.use(cors());

let championNames = {};
let championIcons = {}; 

async function fetchChampionData() {
    try {
        const response = await axios.get('https://ddragon.leagueoflegends.com/cdn/13.16.1/data/en_US/champion.json');
        const championData = response.data.data;

        for (const champion in championData) {
            const championInfo = championData[champion];
            const championId = championInfo.key;
            const championName = championInfo.id;
            const iconUrl = `http://ddragon.leagueoflegends.com/cdn/13.16.1/img/champion/${championInfo.image.full}`;
            championNames[championId] = { name: championName };
            championIcons[championId] = iconUrl;
        }
    } catch (error) {
        console.error('Error fetching champion data:', error.message);
    }
}

fetchChampionData();

app.get('/api/summoner/:region/:name', async (req, res) => {
    try {
        const region = req.params.region;
        const summonerName = req.params.name;
        const regionMapping = {
            'br': 'br1',
            'euw': 'euw1',
            'eune': 'eun1',
            'jp': 'jp1',
            'kr': 'kr',
            'lan': 'la1',
            'las': 'la2',
            'na': 'na1',
            'oc': 'oc1',
            'ru': 'ru',
            'tr': 'tr1',
            'ph': 'ph2',
            'sg': 'sg2',
            'th': 'th2',
            'tw': 'tw2',
            'vn': 'vn2'
        };
        const mappedRegion = regionMapping[region];

        if (!mappedRegion) {
            return res.status(400).send('Invalid region');
        }

        const apiSummoner = `https://${mappedRegion}.api.riotgames.com/lol/summoner/v4/summoners/by-name/${summonerName}?api_key=${apiKey}`;
        const summonerResponse = await axios.get(apiSummoner);

        const encryptedSummonerId = summonerResponse.data.id;
        const apiMasteries = `https://${mappedRegion}.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-summoner/${encryptedSummonerId}?api_key=${apiKey}`;

        const masteriesResponse = await axios.get(apiMasteries);

        const masteriesWithChampionInfo = masteriesResponse.data.map(mastery => {
            const championId = mastery.championId;
            const championInfo = championNames[championId];
            return { ...mastery, championName: championInfo ? championInfo.name : "Unknown Champion", championIcon: championIcons[championId] || "" };
        });

        const summonerInfo = {
            name: summonerResponse.data.name,
            summonerLevel: summonerResponse.data.summonerLevel,
            profileIconId: summonerResponse.data.profileIconId 
        };

        res.json({ summonerInfo, masteries: masteriesWithChampionInfo });
    } catch (error) {
        console.error('Error fetching summoner data:', error.message);
        res.status(500).json({ message: 'An internal server error occurred' });
    }
});

app.get('/:region/:summonerName', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'summoner.html'));
});

app.get('/:region', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
