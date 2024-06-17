const axios = require('axios'); 

const apiUrl = 'https://www.googleapis.com/youtube/v3/search';
const apiKey = 'AIzaSyB21QyNHlc6cU_uwumpK_c5EA0VhOv9T_k';


async function getVideoUrl(videoId) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
                id: videoId,
                part: 'snippet,contentDetails',
                key: apiKey
            }
        });

        if (response.data && response.data.items && response.data.items.length > 0) {
            const videoDetails = response.data.items[0];
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            return videoUrl;
        } else {
            throw new Error('Video not found');
        }
    } catch (error) {
        console.error('Error fetching video:', error);
        throw error;
    }
}

