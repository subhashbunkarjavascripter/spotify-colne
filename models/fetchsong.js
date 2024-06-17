
const songModel = require('./songModel');


async function fetchSongDetails(videoId) {
    try {
      const song = await songModel.findOne({ videoId });
      return song;
    } catch (error) {
      console.error('Error fetching song details:', error);
      return null; 
    }
  }
  
  module.exports = { fetchSongDetails };