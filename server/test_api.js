const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;

(async () => {
  try {
    const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CX,
        q: 'test',
        start: 1,
        num: 1
      }
    });
    console.log("Success!");
    console.log(response.data);
  } catch (error) {
    if (error.response) {
      console.error("API Error Response:");
      console.error(JSON.stringify(error.response.data, null, 2));
      console.error("Requested URL:", error.config.url);
      console.error("Params:", error.config.params);
    } else {
      console.error("Error:", error.message);
    }
  }
})();
