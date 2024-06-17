const io = require( "socket.io" )();
const socketapi = {
    io: io
};

io.on( "connection", function( socket ) {
    console.log( "A user connected" );
});

module.exports = socketapi;