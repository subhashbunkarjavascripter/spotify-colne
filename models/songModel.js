 const mongoose = require("mongoose");


 const songSchema = mongoose.Schema({
    name : String,
    title : String,
    artist : String,
    album: String,
    category : [
        {
            type : String,
            enum :['panjabi', 'gujrati'] 
        }
    ],
    likes : [
        {
            type : mongoose.Schema.Types.ObjectId,
            ref : 'user'
        }
    ],
    size : Number,
    poster : String,
    filename : {
        type : String,
        required : true,
    },
    videoId: String,
    thumbnail: { type: String },
    filename: { type: String, required: true }
 });


 module.exports = mongoose.model('song',songSchema)