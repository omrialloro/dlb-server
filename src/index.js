/**
 * Required External Modules
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const fs = require('fs')
const path = require('path')

var spawn = require('child_process').spawn
const makePngs = require('./PngUtils.js').makePngs
const makeThumbnail = require('./PngUtils.js').makeThumbnail


const { clientOrigins, serverPort } = require("./config/env.dev");

// const { messagesRouter } = require("./messages/messages.router");

const { checkJwt } = require("./authz/check-jwt");


/**
 * App Variables
 */

const app = express();
const apiRouter = express.Router();


app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
})

app.use(express.json({limit: '25mb'}));

/**
 *  App Configuration
 */

app.use(helmet());
app.use(cors({ origin: clientOrigins }));
app.use(express.json());

app.use("/api", apiRouter);

// apiRouter.use("/messages", messagesRouter);

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send(err.message);
});

/**
 * Server Activation
 */

app.listen(serverPort, () => {
  console.log(`API Server listening on port ${serverPort}`);
});

app.get('/animationsList/:username',function (req, res) {
  console.log(req);
  let json_files_list = [];
  const username = req.params.username

  files = fs.readdirSync(__dirname+"/"+username+"/animations")
  files.forEach(file => {
      if (path.extname(file) == ".json")
        json_files_list.push(path.basename(file,".json"));
    })
  var filenames_list = JSON.stringify(json_files_list)
  console.log(filenames_list)
  res.send(filenames_list)
})

app.post('/saveAnimation',checkJwt,(request, response)=>{
  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  var username = data_str["username"]
  console.log(data_str)

  var name = data_str["name"]

  if (!fs.existsSync(username)){
    fs.mkdirSync(username)
  }
  var animation_path = `${username}/animations`
  if (!fs.existsSync(animation_path)){
    fs.mkdirSync(animation_path)
  }
  fs.writeFile(`${animation_path}/${name}.json`, data, function (err) {
  if (err) return console.log(err);
  });

  if (!fs.existsSync(`${username}/thumbnailFrames`)){
    fs.mkdirSync(`${username}/thumbnailFrames`)
  }
  makeThumbnail(`${username}/thumbnailFrames/${data_str["name"]}`,data_str["ThumbnailFrame"])
})


app.get('/loadAnimation/:username/:filename',checkJwt, function (req, res) {
  let json_files_list = [];
  console.log("FFFFFF")
  const username = req.params.username
  const filename = req.params.filename

  console.log(username)
  console.log(__dirname+`/${username}/animations/${filename}.json`)


  var data = fs.readFileSync(__dirname+`/${username}/animations/${filename}.json`)
  var data_str = JSON.parse(data)
  res.send(data_str)
})

app.get('/thumbnail/:filename/:username',checkJwt, function (req, res) {
  const filename = req.params.filename
  const username = req.params.username
  var thumbnailsPath = __dirname+`/${username}/thumbnailFrames`
    res.sendFile(`/${thumbnailsPath}/${filename}.png`);
})

app.post('/gif',checkJwt,(request, response)=>{
  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  console.log("*******")
  var username = data_str["username"]

  var name = data_str["name"]
  console.log("name is:" +name)
  var speed = data_str["speed"]
  console.log(`speed is:${speed}`)
  var frames = data_str["data"]
  let num_files = frames.length
  console.log("number of frames is:"+ num_files)

  var gifs_path = `${username}/extracted_gifs`
  if (!fs.existsSync(gifs_path)){
    fs.mkdirSync(gifs_path)
  }

  fs.writeFile(`${username}/extracted_gifs/${data_str["name"]}.json`, data, function (err) {
    if (err) return console.log(err);
  });

  makePngs(name,frames)
  console.log("exit makePngs")
  if (!fs.existsSync('extracted_gifs')){
    fs.mkdirSync('extracted_gifs')
  }

let counter = 0
  const intervalObj = setInterval(function() {
    counter +=1
    console.log("counter is" +counter)
      let is_ready = checkFilesReady(name, num_files)
      console.log("is_ready: "+ is_ready)
      if (is_ready&&counter>10) {
        clearInterval(intervalObj);
        setTimeout(()=>{
          console.log("files are ready")
          console.log('calling python...');
          spawn('python3', ['convert_png.py',name,username, speed])
        },3000)
      }
  }, 500);
})
app.get('/download/:filename/:username', (req,res)=>{
  let filename = req.params.filename
  let username = req.params.username

  console.log("dffdf")
  gif_path = `${username}/extracted_gifs/${filename}.gif`
  let is_ready = false
  const intervalObj = setInterval(function() {

      let file = gif_path;
      let fileExists = fs.existsSync(file);
      if (fileExists){
        is_ready = fs.statSync(gif_path).size>100
      }
      console.log("is exists:"+fileExists)
      console.log("is ready:"+is_ready)

      if (is_ready) {
          clearInterval(intervalObj);
          setTimeout(()=>{res.download(gif_path);
          console.log("READY")
          },4000)
          // setTimeout(()=>{fs.unlinkSync(gif_path)},10000)
      }
  }, 2000);
})

function checkFilesReady(name,num_files){
  files = fs.readdirSync(name)
  if (files.length!=num_files){
    return false
  }
  else {
    is_ready = true
    tot_size = 0
    for(let i=0; i<num_files; i++){
      let stat = fs.statSync(name+"/"+files[i])
      tot_size += stat.size
      if (stat.size<10){
        is_ready = false
      }
    }
    console.log(tot_size)
    return is_ready
  }
}
