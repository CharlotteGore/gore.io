var uriTemplate = require('uritemplate');
var http = require('http');

function SparkleSparkleGo ( hostname, port, uri ){

  this.rootUri = uriTemplate.parse(uri);
  this.hostname = hostname;
  this.port = port;
  return this;

}

SparkleSparkleGo.prototype = {

  query : function setQuery(query){

    var uri = this.rootUri.expand({ query : {
        query : query
      }
    });

    var hostname = this.hostname;
    var port = this.port;

    return {

      execute : function executeQuery(callback){

        http.get({ path : uri, hostname : hostname, port : port }, function (res){

          var buffer = "";

          res.on('data', function (data){

            if (!buffer){
              
              buffer = data

            } else {

              buffer += data;
            }

          });

          res.on('end', function (){

            if (typeof buffer !== "string"){
              buffer = buffer.toString('utf8');
            }

            if (buffer.substr){

              callback(false, buffer.substr(1));

            } else {
              callback(false, buffer);
            }

          });

        });

      }

    };

  }

};

module.exports = SparkleSparkleGo;