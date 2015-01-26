var express = require('express');
var http = require('http');
var watchr = require('watchr');
var path = require('path');
var fs = require('fs');

process.title = "gore.io";

// command line args..
var projectRoot = process.env.PROJECT_DIR || false;
var port = process.env.MIMIR_PORT || false;
var proxyHost = process.env.OLDDEMO_PORT_80_TCP_ADDR || process.env.LD_HOST || false;
var proxyPort = process.env.OLDDEMO_PORT_80_TCP_PORT || process.env.LD_PORT || false;

if (!projectRoot || !port || !proxyHost || !proxyPort){
  console.log('Ensure that PROJECT_DIR, MIMIR_PORT, LD_HOST and LD_PORT environment variables are set');
  process.exit();
}

require('./proxy').configure(proxyHost, proxyPort);

var root = 'http://localhost:' + port + '/vfs/';

// broker...

var broker = new (require('events')).EventEmitter;

// virtual file system...
var vfs = require('vfs-local')({
  root: projectRoot,
  httpRoot: root,
});

// file system watcher...
watchr.watch({
  paths : [projectRoot],
  listeners : {
    change : function(changeType,filePath,fileCurrentStat,filePreviousStat){
      console.log(changeType);
      broker.emit(changeType, {
        path : filePath.replace(projectRoot, '')
      });
    }
  }
});


function createApplicationAndBeginListening (port, vfs, broker){

  var app = express({
    'view cache' : false
  });

  // static files handler... 
  app.use(express.static(path.join(__dirname, './public')));
  
  // file system over http..
  app.use(require('vfs-http-adapter')('/vfs/', vfs));

  // just send a static file for the root...
  app.get('/', function (req, res){

    fs.readFile('./public/index.html', 'utf8', function (err, data){

      res.send(data);

    });

  });

  require('./proxy').listen(app);

  var server = require('http').Server(app);

  var sockjs = require('sockjs');
  var sock = sockjs.createServer();

  var socketConnections = [];

  sock.on('connection', function (conn){

    socketConnections.push(conn);

    conn.write(JSON.stringify({ hello : 'world'}));

    conn.on('data', function (message){

      var msg = JSON.parse(message);
      for (var i in msg){
        if (msg.hasOwnProperty(i) && handlers[i]){
          handlers[i](msg[i])
        }
      }

    });

    conn.on('close', function (){
      // remove the socket from the list
      socketConnections.splice(socketConnections.indexOf(conn), 1);

    });

  });

  broker.on('create', function (msg){
    socketConnections.forEach(function (conn){
      conn.write(JSON.stringify({create : msg}));
    })
  });
  broker.on('update', function (msg){
    socketConnections.forEach(function (conn){
      conn.write(JSON.stringify({ update : msg }));
    });
  });
  broker.on('delete', function (msg){
    socketConnections.forEach(function (conn){
      conn.write(JSON.stringify({ 'delete' : msg }));
      //conn.write('update', JSON.stringify(msg));
    });
  });

  sock.installHandlers(server, { prefix : '/comms'});
  server.listen(port, '0.0.0.0');

  console.log('Server ready for connections at http://localhost:' + port);

};

createApplicationAndBeginListening(port, vfs, broker);
