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

const passport = require('passport');
const mongoose  = require('mongoose');

passport.use(new localStrategy(users.authenticate()));

mongoose.connect('mongodb://0.0.0.0/socketio').then(() => {
  console.log('connect to database');

}).catch(err => {
    console.log(err)
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
  const CurrentUser = await userModel.findOne({
    _id : req.user._id,
  }).populate('playlist').populate({
    path: 'playlist',
    populate:{
      path: 'song',
      model: 'song'
    }
  })
  res.render('index', {CurrentUser} );
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

router.get('/stream/:musicName', async function(req,res,next){
  const currentsong = await songModel.findOne({
    filename : req.params.musicName
  })

  const stream = gfsBucket.openDownloadStreamByName(req.params.musicName);

  res.set('Content-Type','audio/mpeg');
  res.set('Content-Length', currentsong.size);
  res.set('Content-Range',`bytes 0-${currentsong.size - 1}/${currentsong.size}`);
  res.set('Content-Ranges', 'byte');

  res.status(206);

  stream.pipe(res);


});

router.get('/search', function(req,res,next){
  res.render('search')
})

router.post('/search', async function(req,res,next){

  const searchedMusic = await songModel.find({
    title:{$regex: req.body.search}
  })

  res.json({
    songs : searchedMusic
  })

})


module.exports = router;
