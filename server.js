// server.js
// where your node app starts
const https = require("https");

// init project
const express = require('express');

var app = express();
const searchHostname = 'www.googleapis.com'
const searchPath = '/customsearch/v1?key=' +
      process.env.APIKEY +
      '&cx=' +
      process.env.CX


const MongoClient = require('mongodb').MongoClient;

const mongoUrl = "mongodb://" + 
    process.env.DB_USERNAME +
    ':' +
    process.env.DB_PASSWORD +
    '@' +
    process.env.DB_URL +
    '/freecodecamp'

const mongoColl = 'image-search-history'



// we've started you off with Express, 
// but feel free to use whatever libs or frameworks you'd like through `package.json`.

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get("/api/imagesearch/:str", function (request, response) {
  console.log(request.params.str)
  var offset = 0
  if (request.query.offset) {
    console.log(request.query.offset)
    offset = parseInt(request.query.offset)
  }
  if (!offset) offset = 1
  console.log(request.headers);
  const options = {
    host: searchHostname,
    path: searchPath + '&q=' + encodeURIComponent(request.params.str) + '&start=' + offset,
    headers: {
        'Referer': request.headers['host'],
    }
  }
  
  imageSearch(options, function(err, results) {
    if (err) response.send("error")
    else response.send(results)  
    
    //save search string
    if (!err) {
      MongoClient.connect(mongoUrl, function(err, db) {
        if (err) throw err;

        var coll = db.collection(mongoColl)

        coll.insertOne({ term: request.params.str, when: new Date() }, function(err, res) {
          if (err) throw err;
          console.log("insert result: %s", JSON.stringify(res.result));
          db.close();
        }) //insertOne
      }) // connect()
    } // if not err
  })
  
});



// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});


function imageSearch(options, cb) {
  console.log("fetching %s", options.host + options.path) 
     
  https.get(options, res => {
    res.setEncoding("utf8");
    let body = "";
    res.on("data", data => {
      body += data;
    });
    res.on("end", () => {
      body = JSON.parse(body);
      var res = []; //body.items;
      
     
      body.items.forEach(function(d,i) {
        if (d.pagemap.hasOwnProperty('cse_thumbnail')) {
          res.push({
            url: d.pagemap.cse_image[0].src,
            snippet: d.snippet,
            thumbnail: d.pagemap.cse_thumbnail[0].src,
            context: d.link
          })
        }
      })
      
      console.log(res)
      cb(false, res)
    });
  });
}

app.get("/api/latest/imagesearch/", function (request, response) {
  MongoClient.connect(mongoUrl, function(err, db) {
    if (err) throw err;

    var coll = db.collection(mongoColl)

    coll.find({}, {_id: false, term: true, when: true}).sort({when : -1}).limit(10).toArray(function(err, results) {
      if (err) throw err
      console.log("find result: %s", results)
      db.close()
      response.send(results)
    }) //find
  }) // connect()
})