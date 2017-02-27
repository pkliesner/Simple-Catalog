/**
 * server.js
 * This file defines the server for a
 * simple photo gallery web app.
 */
"use strict;"

/* global variables */
var multipart = require('./multipart');
var template = require('./template');
var http = require('http');
var url = require('url');
var fs = require('fs');
var port = 3000;

/* load cached files */
var config = JSON.parse(fs.readFileSync('config.json'));
var stylesheet = fs.readFileSync('gallery.css');
var detailStylesheet = fs.readFileSync('details.css');

/* load templates */
 template.loadDir('templates');

///////////////////////////////////////////////////////
/**
 * @function buildDetail
 * A helper function to build an HTML string of a detail webpage.
 * @param {string} imageTag - the filename in a string
 * @param {object} data - the JSON data in an object.
 */
function buildDetail(imageTag, data) {
  return template.render('detail.html', data);
}

/** @function getImageNames
 * Retrieves the filenames for all images in the
 * /images directory and supplies them to the callback.
 * @param {function} callback - function that takes an
 * error and array of filenames as parameters
 */
function getImageNames(callback) {
  fs.readdir('images/', function(err, fileNames){
    if(err) callback(err, undefined);
    else callback(false, fileNames);
  });
}

/** @function imageNamesToTags
 * Helper function that takes an array of image
 * filenames, and returns an array of HTML img
 * tags build using those names.
 * @param {string[]} fileNames - the image filenames
 * @return {string[]} an array of HTML img tags
 */
function imageNamesToTags(fileNames) {
  return fileNames.map(function(fileName) {
    return `<a href="detail/${fileName}"><img src="${fileName}" alt="${fileName}"></a>`;
  });
}

/**
 * @function buildGallery
 * A helper function to build an HTML string
 * of a gallery webpage.
 * @param {string[]} imageTags - the HTML for the individual
 * gallery images.
 */
function buildGallery(imageTags) {
  var newTags = imageNamesToTags(imageTags).join("");
  return template.render('gallery.html', {
	  title: config.title,
	  imageTags: newTags
  });
}

/////////////////////////////////////////////////////////////
/** @function serveDetail
 * A function to serve a HTML page representing a detailed page of an image.
 * @param {string} filename - the filename
 * @param {http.incomingRequest} req - the request object
 * @param {http.serverResponse} res - the response object
 */
function serveDetail(filename, req, res) {
  var splitFileName = filename.split('.');
  var newFileName = 'catalog/' + splitFileName[0] + '.json';

  fs.readFile(newFileName, function(err, data){
    if(err) {
      console.error(err);
      res.statusCode = 500;
      res.statusMessage = 'Server error';
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(buildDetail(filename, JSON.parse(data)));    
  });
}

/** @function serveGallery
 * A function to serve a HTML page representing a
 * gallery of images.
 * @param {http.incomingRequest} req - the request object
 * @param {http.serverResponse} res - the response object
 */
function serveGallery(req, res) {
  getImageNames(function(err, imageNames){
    if(err) {
      console.error(err);
      res.statusCode = 500;
      res.statusMessage = 'Server error';
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(buildGallery(imageNames));
  });
}

/** @function serveImage
 * A function to serve an image file.
 * @param {string} filename - the filename of the image
 * to serve.
 * @param {http.incomingRequest} - the request object
 * @param {http.serverResponse} - the response object
 */
function serveImage(fileName, req, res) {
  fs.readFile('images/' + decodeURIComponent(fileName), function(err, data){
    if(err) {
      console.error(err);
      res.statusCode = 404;
      res.statusMessage = "Resource not found";
      res.end();
      return;
    }
    res.setHeader('Content-Type', 'image/*');
    res.end(data);
  });
}

/** @function uploadImage
 * A function to process an http POST request
 * containing an image to add to the gallery.
 * @param {http.incomingRequest} req - the request object
 * @param {http.serverResponse} res - the response object
 */
function uploadImage(req, res) {
  multipart(req, res, function(req, res) {
    // make sure an image was uploaded
    if(!req.body.image.filename) {
      console.error("No file in upload");
      res.statusCode = 400;
      res.statusMessage = "No file specified"
      res.end("No file specified");
      return;
    }
    fs.writeFile('images/' + req.body.image.filename, req.body.image.data, function(err){
      if(err) {
        console.error(err);
        res.statusCode = 500;
        res.statusMessage = "Server Error";
        res.end("Server Error");
        return;
      }
      serveGallery(req, res);
    });
  });
}

////////////////////////////////////////////////////
function uploadJSON(req, res) { 
  multipart(req, res, function(req, res) {
    // make sure an title/description were uploaded
    if(req.body.title == "") {
      console.error("No title in upload");
      res.statusCode = 400;
      res.statusMessage = "No title specified"
      res.end("No title specified");
      return;
    }
    else if(req.body.description == "") {
      console.error("No description in upload");
      res.statusCode = 400;
      res.statusMessage = "No description specified"
      res.end("No description specified");
      return;
    }

    var iFileName = "images/" + req.body.image.filename;
    var qFileName = "'" + iFileName + "'";
    var splitFileName = req.body.image.filename.split('.');
    fs.writeFile('catalog/' + splitFileName[0] + '.json', 
      '{"image" : { "imageName" : "' + iFileName + '", "imageTag" : "<a href=' + qFileName + '><img src=' + qFileName + ' alt=' + qFileName + '></a>", "title" : "' + req.body.title + '", "description" : "' + req.body.description +'" }}',
      function(err){
      if(err) {
        console.error(err);
        res.statusCode = 500;
        res.statusMessage = "Server Error";
        res.end("Server Error");
        return;
      }
      //serveGallery(req, res);
    });
  });
}

/** @function handleRequest
 * A function to determine what to do with
 * incoming http requests.
 * @param {http.incomingRequest} req - the incoming request object
 * @param {http.serverResponse} res - the response object
 */
function handleRequest(req, res) {
  // at most, the url should have two parts -
  // a resource and a querystring separated by a ?
  var urlParts = url.parse(req.url);

  if(urlParts.query){
    var matches = /title=(.+)($|&)/.exec(urlParts.query);
    if(matches && matches[1]){
      config.title = decodeURIComponent(matches[1]);
      fs.writeFile('config.json', JSON.stringify(config));
    }
  }

  switch(urlParts.pathname) {
    case '/':
    case '/gallery':
      if(req.method == 'GET') {
        serveGallery(req, res);
      } else if(req.method == 'POST') {
        uploadImage(req, res);
        uploadJSON(req, res);
      }
      break;
    case '/gallery.css':
      res.setHeader('Content-Type', 'text/css');
      res.end(stylesheet);
      break;
    default:
      //////////////////////////////////////////////
      var pathName = urlParts.pathname;
      var pathParts = pathName.split('/');
      var fileName = pathParts[2];

      //pathParts[0] is an empty string caused by the leading '/'
      if(pathParts[1] == 'detail'){
        switch(pathParts[2]){
          case "images":
            serveImage(pathParts[3], req, res);
            break;
          case 'details.css':
            res.setHeader('Content-Type', 'text/css');
            res.end(detailStylesheet);
            break;
          case 'details.json':
          case 'gallery.json':
          break;
          default:
            serveDetail(fileName, req, res);
        }
      }
      else serveImage(req.url, req, res);
  }
}

/* Create and launch the webserver */
var server = http.createServer(handleRequest);
server.listen(port, function(){
  console.log("Server is listening on port ", port);
});