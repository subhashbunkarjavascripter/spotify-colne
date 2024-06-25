var express = require('express');
var router = express.Router();
var users = require("../models/userModel");
var songModel = require('../models/songModel');
var playlistModel = require('../models/playlistModel');
var localStrategy = require('passport-local');
const userModel = require('../models/userModel');
const multer = require('multer');
var id3 = require('node-id3');
const { Readable } = require('stream');
const crypto = require('crypto');

require('dotenv').config();

const axios = require('axios'); 
const { exec: execChildProcess } = require('child_process');
const { exec: execYoutubeDL } = require('youtube-dl-exec');

const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');

const apiUrl = 'https://www.googleapis.com/youtube/v3/search';

const apiKey = 'AIzaSyB21QyNHlc6cU_uwumpK_c5EA0VhOv9T_k';

const passport = require('passport');
const mongoose  = require('mongoose');

passport.use(new localStrategy(users.authenticate()));

const dbURI = 'mongodb+srv://subhashbunkarjavascripter9685:9fdTsdUfeZlI0FSs@cluster0.vuy8vkh.mongodb.net/socketio?retryWrites=true&w=majority&appName=Cluster0';
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/socketio'; 

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

db.once('open', () => {
  console.log('Connected to MongoDB');
});

mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.once('open', () => {
  console.log('Connected to MongoDB');
});

const conn = mongoose.connection

var gfsBucket, gfsBucketPoster

conn.once('open',()=>{

  gfsBucket = new mongoose.mongo.GridFSBucket(conn.db,{
    bucketName: 'audio'
  });

  gfsBucketPoster = new mongoose.mongo.GridFSBucket(conn.db,{
    bucketName: 'poster'
  });

  console.log('GridFS Buckets initialized'); 



})


router.post('/register', async function(req,res,next){
  var newUser = users ({
    email: req.body.email,
    username : req.body.username,
  });
  users
  .register(newUser,req.body.password)
  .then(function(){
    passport.authenticate('local')(req,res,async function(){
      const songs = await songModel.find();
      const defaultPlayList = await playlistModel.create({
        name: req.body.username,
        onwer: req.user._id,
        song : songs.map(song => song._id)
      })
      const newUser = await userModel.findOne({
        _id: req.user._id,
      })

      newUser.playlist.push(defaultPlayList._id)
      await newUser.save();
       
      res.redirect('/')
    })
  })
  .catch(function(err){
    res.send(err)
  })
});

router.get('/auth',function(req,res,next){
  res.render("register")
})


router.post('/login',passport.authenticate('local',{
  successRedirect : '/',
  failureRedirect : '/auth'
}),function(req,res,next){
});

router.get('/logout',function(req,res,next){

  if(req.isAuthenticated()){
    req.logout((err) =>{
     if(err) res.send(err);
     else res.redirect('/');
    });
  }else{
    res.redirect('/')
  }
});

function isLoggedin(req,res,next){
  if(req.isAuthenticated()){
    return next();
  }else{
    res.redirect('/auth');
  }
};

function isAdmin(req,res,next){
  if(req.user.isAdmin){
    return next();
  }else{
    res.redirect('/');
  }
};


router.get('/', isLoggedin, async function(req, res, next) {
  try {
    const CurrentUser = await userModel.findOne({
      _id: req.user._id,
    }).populate('playlist').populate({
      path: 'playlist',
      populate: {
        path: 'song',
        model: 'song'
      }
    });
    const songDetails = CurrentUser.playlist[0].song[0];


    res.render('index', { CurrentUser, songDetails });
  } catch (error) {
    console.error('Error in / route:', error);
    res.status(500).send('Internal Server Error');
  }
});


const storage = multer.memoryStorage()
const upload = multer({ storage: storage });
router.post('/uploadMusic', isLoggedin, isAdmin, upload.array('song'), async function(req, res, next) {
 
  await Promise.all(req.files.map(async file =>{
    const randomName = crypto.randomBytes(20).toString('hex');
  
  const songdata = id3.read(file.buffer);
  Readable.from(file.buffer).pipe(gfsBucket.openUploadStream(randomName));
  Readable.from(songdata.image.imageBuffer).pipe(gfsBucketPoster.openUploadStream(randomName + 'poster'));
  
  await songModel.create({
    name : songdata.name,
    title : songdata.title,
    artist : songdata.artist,
    album : songdata.album,
    size : file.size,
    poster : randomName + 'poster',
    filename : randomName
  });
}));
   res.send('songs uploaded');
});

router.get('/uploadMusic',isLoggedin, isAdmin, function(req, res, next) {
  res.render('uploadMusic');
});

router.get('/poster/:posterName', function(req, res, next) {
   gfsBucketPoster.openDownloadStreamByName(req.params.posterName).pipe(res)

});


router.get('/search', isLoggedin, function(req,res,next){
  const songDetails = songModel.find().limit(20);
  const CurrentUser = userModel.findOne({user: req.session.passport.user});
  res.render('search',{songDetails,CurrentUser})
});


router.get('/saveAndPlay/:videoId', async (req, res) => {
  const videoId = req.params.videoId;
  try {
    const info = await ytdl.getInfo(videoId);
    const title = info.videoDetails.title;
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

    const filePath = path.join(__dirname, '../public/songs', `${videoId}.mp3`);
    ytdl(videoId, { format: audioFormat }).pipe(fs.createWriteStream(filePath))
      .on('finish', async () => {
        const newSong = new Song({
          title: title,
          filename: `${videoId}.mp3`,
          videoId: videoId
        });
        await newSong.save();
        res.json({ success: true, songId: newSong._id });
      });
  } catch (error) {
    console.error(error);
    res.json({ success: false });
  }
});
 



router.post('/getSongDetails', async (req, res) => {
  try {
    console.log('getSongDetails request body:', req.body);

    const { filename } = req.body;
    const song = await songModel.findOne({ filename });

   

    if (!song) {
      return res.status(404).json({ error: 'Song not found' });
    }

    res.json({ song });
  } catch (error) {
    console.error('Error in /getSongDetails:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function fetchSongsFromDatabase() {
  try {
      const songs = await songModel.find(); 
      return songs;
  } catch (error) {
      console.error('Error fetching songs from database:', error);
      throw error;
  }
}

router.get('/playsong', async (req, res) => {
  const videoId = req.query.videoId;
  console.log('Video ID:', videoId); 
  try {
    const info = await ytdl.getInfo(videoId);
    const title = info.videoDetails.title;
    const thumbnail = info.videoDetails.thumbnails[0].url;
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

    const filePath = path.join(__dirname, '../public/songs', `${videoId}.mp3`);
    
    ytdl(videoId, { format: audioFormat }).pipe(fs.createWriteStream(filePath))
      .on('finish', async () => {
        const newSong = new songModel({
          title: title,
          filename: `${videoId}.mp3`,
          videoId: videoId,
          thumbnail: thumbnail
        });
        await newSong.save();
        const songs = [newSong];
        const dbsongs = await songModel.find({}).limit(20);

        res.render('playsong', { songs: songs, dbsongs });
      });
  } catch (error) {
    console.error(error);
    res.send('Error playing the song');
  }
});

router.get('/stream/public/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../public/songs', filename);
  res.sendFile(filePath);
});


router.get('/stream/:filename', async function(req,res,next){
  const currentsong = await songModel.findOne({
    filename : req.params.filename
  })

  const stream = gfsBucket.openDownloadStreamByName(req.params.filename);

  res.set('Content-Type','audio/mpeg');
  res.set('Content-Length', currentsong.size);
  res.set('Content-Range',`bytes 0-${currentsong.size - 1}/${currentsong.size}`);
  res.set('Content-Ranges', 'byte');

  res.status(206);

  stream.pipe(res);


});




router.get('/api/songs/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
      const response = await axios.get(apiUrl, {
          params: {
              key: apiKey,
              id: videoId,
              part: 'snippet'
          }
      });

      const songData = {
          title: response.data.items[0].snippet.title,
          artist: response.data.items[0].snippet.channelTitle,
         
      };

      res.json(songData);
  } catch (error) {
      console.error('Error fetching song data:', error);
      res.status(500).json({ error: 'Failed to fetch song data' });
  }
});


router.get('/stream/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'songs', filename);

  if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
          const parts = range.replace(/bytes=/, "").split("-");
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
          const chunksize = (end - start) + 1;
          const file = fs.createReadStream(filePath, { start, end });
          const head = {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'audio/mpeg',
          };

          res.writeHead(206, head);
          file.pipe(res);
      } else {
          const head = {
              'Content-Length': fileSize,
              'Content-Type': 'audio/mpeg',
          };

          res.writeHead(200, head);
          fs.createReadStream(filePath).pipe(res);
      }
  } else {
      res.status(404).send('File not found');
  }
});



router.get('/getnextsong', async (req, res) => {
  try {
      let nextSong;
      if (req.session.currentSong) {
          nextSong = await songModel.findOne({ filename: req.session.currentSong });
          if (!nextSong) {
              nextSong = await songModel.findOne().sort({ _id: 1 });
          } else {
              nextSong = await songModel.findOne({ _id: { $gt: nextSong._id } }).sort({ _id: 1 });
          }
      } else {
          nextSong = await songModel.findOne().sort({ _id: 1 });
      }

      if (!nextSong) {
          return res.status(404).json({ error: 'Next song not found' });
      }

      req.session.currentSong = null;

      req.session.currentSong = nextSong.filename;

      res.json({ filename: nextSong.filename });
  } catch (error) {
      console.error('Error in /getnextsong:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/getprevioussong', async (req, res) => {
  try {
      let previousSong;
      if (req.session.currentSong) {
          previousSong = await songModel.findOne({ filename: req.session.currentSong });
          if (!previousSong) {
              previousSong = await songModel.findOne().sort({ _id: -1 });
          } else {
              previousSong = await songModel.findOne({ _id: { $lt: previousSong._id } }).sort({ _id: -1 });
          }
      } else {
          previousSong = await songModel.findOne().sort({ _id: -1 });
      }

      if (!previousSong) {
          return res.status(404).json({ error: 'Previous song not found' });
      }

      req.session.currentSong = null;

      req.session.currentSong = previousSong.filename;

      res.json({ filename: previousSong.filename });
  } catch (error) {
      console.error('Error in /getprevioussong:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});


async function saveSong(songData) {
  try {
      const newSong = await Song.create(songData);
      console.log('Song saved successfully:', newSong);
      return newSong;
  } catch (error) {
      console.error('Error saving song:', error);
      throw error;
  }
}


router.get('/getcurrentsong', async (req, res) => {
  try {
    const currentSongFilename = req.session.currentSong;
    if (!currentSongFilename) {
      return res.status(404).json({ error: 'Current song not set' });
    }

    const currentSong = await songModel.findOne({ filename: currentSongFilename });
    if (!currentSong) {
      return res.status(404).json({ error: 'Current song not found' });
    }
    console.log('Fetching current song...');

    res.json({ currentSong });
  } catch (error) {
    console.error('Error in /getcurrentsong:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/setcurrentsong', async (req, res) => {
  try {
      const { filename } = req.body;
      const song = await songModel.findOne({ filename });

      if (!song) {
          return res.status(404).json({ error: 'Song not found' });
      }

      req.session.currentSong = filename;
      res.status(200).json({ message: 'Current song set successfully' });
  } catch (error) {
      console.error('Error in /setcurrentsong:', error);
      res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/showplaylist', async (req, res) => {
  try {
      const songs = await songModel.find({});
      res.render('playsong', { songDetails: {}, songs });
  } catch (error) {
      res.status(500).send('Error fetching songs');
  }
});


const extractionStatus = {};

router.post('/extract-audio', async (req, res) => {
  try {
    const { videoId } = req.body;
    const extractionId = crypto.randomBytes(20).toString('hex');
    const command = `youtube-dl -x --audio-format mp3 https://www.youtube.com/watch?v=${videoId}`;

    execYoutubeDL(command, async (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        res.status(500).json({ error: 'Failed to extract audio' });
        return;
      }

      console.log(`stdout: ${stdout}`);
      console.error(`stderr: ${stderr}`);

      const audioUrl = extractAudioUrl(stdout);  
      extractionStatus[extractionId] = { status: 'complete', audioUrl };

      res.json({ message: 'Audio extracted successfully', extractionId });
    });
  } catch (error) {
    console.error('Error in /extract-audio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function extractAudioUrl(stdout) {
  const lines = stdout.split('\n');
  for (let line of lines) {
    if (line.startsWith('[ffmpeg] Destination:')) {
      return line.split(' ')[2];
    }
  }
  return null;
}


router.get('/check-extraction-status/:extractionId', async (req, res) => {
  try {
    const { extractionId } = req.params;

    if (extractionStatus[extractionId]) {
      res.json(extractionStatus[extractionId]);
    } else {
      res.status(404).json({ error: 'Extraction ID not found' });
    }
  } catch (error) {
    console.error('Error in /check-extraction-status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/getaudio', async (req, res) => {
  try {
    const videoId = req.query.videoId;

    if (!videoId) {
      return res.status(400).json({ error: 'videoId parameter is required' });
    }

    const command = `youtube-dl -x --audio-format mp3 --get-url https://www.youtube.com/watch?v=${videoId}`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        return res.status(500).json({ error: 'Failed to retrieve audio URL' });
      }

      console.log(`stdout: ${stdout}`);  
      console.error(`stderr: ${stderr}`);

      const audioUrl = stdout.trim();
      console.log(`Audio URL: ${audioUrl}`);  

      res.json({ audioUrl });
    });
  } catch (error) {
    console.error('Error in /getaudio:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/search', async (req, res) => {
  try {
    const searchQuery = req.body.search;
    const apiUrl = 'https://www.googleapis.com/youtube/v3/search';
    const apiKey = 'AIzaSyB21QyNHlc6cU_uwumpK_c5EA0VhOv9T_k';
    const searchUrl = `${apiUrl}?part=snippet&maxResults=20&q=${encodeURIComponent(searchQuery)}&key=${apiKey}`;

   

    const response = await axios.get(searchUrl, {
      proxy: false  
    });

   

    const items = response.data.items;

    const songs = items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description,
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails.default.url
    }));

    res.json({ songs });

  } catch (error) {
    console.error('Error in /search:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


async function playAudioFromYouTube(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const audioUrl = await execYoutubeDL(url, ['-x', '--audio-format', 'mp3']);

    console.log('Audio URL:', audioUrl);
  } catch (error) {
    console.error('Error:', error);
  }
}


  router.get('/audio', (req, res) => {
    const audioPath = 'audio.mp3'; 
    res.sendFile(audioPath, { root: __dirname });
  });


module.exports = router;

