var queries = require('./lib/queries.js');
var uris = require('./lib/uris.js');
var SparkleSparkleGo = require('./lib/sparkle-sparkle-go.js');
var parseTriples = require('./lib/triN3ty.js');

var TrieSearch = require('trie-search');

var cache = {};

var spaql;

module.exports.configure = function (hostname, port){
  //sparql = new SparkleSparkleGo('ld.local', 8030, );
  sparql = new SparkleSparkleGo(hostname, port, '/sparql/query{?query*}');
  
}

module.exports.listen = function (app){

  var 

  // get the initial list of concepts... 
  sparql
    .query(queries.tagsForType('nice:Recommendation'))
    .execute(parseTriples(function (err, tx){

      console.log('Ready to serve concepts')

      var ts = new TrieSearch();

      tx.forEach(function (triple){

          // strip the quotation marks
          var object = triple.object.replace(/\"/g, ''); 
          var subject = triple.subject;

          var temp = {};
          temp[object.toLowerCase()] = {object : object, subject : subject};

          ts.addFromObject(temp);

      });

      app.get('/ld/concepts/:term', function (req, res){

        var term = req.params.term.toLowerCase();

        var results = ts.get(term);

        // sort alphabetically;
        results = results.sort(function (a, b){
          // shortest term first...
          if (a._key_ < b._key){
            return -1;
          } else if (a._key_ > b._key_){
            return 1;
          } else {
            return 0;
          }
          
        });

        results = results.sort(function (a, b){
          if (a._key_.indexOf(term) < b._key_.indexOf(term)){
            return -1;
          } else if (a._key_.indexOf(term) > b._key_.indexOf(term)){
            return 1;
          } else {
            return 0;
          }
        });

        res.send(results.slice(0,5));

      });

      app.get('/ld/recommendations/:tag', function (req, res){

        if (!cache[req.params.tag]){

          sparql
            .query(queries.contentMatching('nice:Recommendation', req.params.tag))
            .execute(parseTriples(function (err, triples){

              if (!err){
                cache[req.params.tag] = triples;
                res.send(triples);
              }

            }));

        } else {
          res.send(cache[req.params.tag]);
        }

      });

    }));

}; 