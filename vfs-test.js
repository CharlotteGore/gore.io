var root = "http://localhost:8761/rest/";
var express = require('express');
var http = require('http');

var vfs = require('vfs-local')({
  root: process.cwd(),
  httpRoot: root,
});

var app = express({
  'view cache' : false
});

app.use(require('vfs-http-adapter')('/rest/', vfs));
app.get('/', function (req, res){

  res.send('Hello');

})

vfs.watch(process.cwd(), {}, function (err, res){

  console.log('change detected!');

});

/*
require('http').createServer(require('stack')(
  require('vfs-http-adapter')("/rest/", vfs)
)).listen(8080);
*/

var server = require('http').Server(app);

server.listen(8761, '0.0.0.0');
console.log("RESTful interface at " + root);

/*

  Hello Charlotte.

  You have a file system API here. The client can consume this and get and update files. It is cool. 
  Next thing is going to be watching files. Need to be able to issue signals whenever files are changed. 
  VFS supports watching, so the trick will be recursively going through 

*/