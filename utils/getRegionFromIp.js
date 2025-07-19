const axios = require('axios');

async function getRegionFromIp(ip) {
    try{
        const response = await axios.get(`https://ipapi.co/${ip}/json/`);
        const data = response.data;
        return data.region || 'Unknown';
    }
    catch(err){
        console.error(`IP Lookup failed: ${err}`);
        return 'Unknown';
    }
}

module.exports = getRegionFromIp;