/**
 * Required External Modules
 */

const express = require("express");
const router = express.Router();

const cors = require("cors");
const helmet = require("helmet");
const fs = require('fs')
const path = require('path')
const AWS = require("aws-sdk")

var spawn = require('child_process').spawn
const makePngs = require('./PngUtils.js').makePngs
const makeThumbnail = require('./PngUtils.js').makeThumbnail



const { clientOrigins, serverPort } = require("./config/env.dev");

// const { messagesRouter } = require("./messages/messages.router");

const { checkJwt } = require("./authz/check-jwt");
AWS.config.update({region:'eu-central-1'});

// const dynamodb = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});

// const dynamodbTableName = 'dlb';
const dynamodbTableName = 'animations';


// AWS.config.getCredentials(function(err) {
//   if (err) console.log(err.stack);
//   // credentials not loaded
//   else {
//     console.log("Access key:", AWS.config.credentials.accessKeyId);
//     const ec2instance = new AWS.EC2InstanceConnect()
//     var params = {
//       InstanceId: 'i-06e04e453f162d248', /* required */
//       InstanceOSUser: 'ec2-user', /* required */
//       SSHPublicKey: 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCz43NHKF3k70uiHdjxpXY7EBeZ06a/Vuj3vzrsJCxuondlgd5SMzCesJNPLXpIa1zRObvLXZucS7oERLGSqCzhcLC/ZLeHN9shVPtFwkbPYGJPFtklMveV7GbGT1ofyGns5ghT9f/4bL5prdLVZOr4FOXrOoWHfzYm6IIkRiOI5UcIoNrA4mXH+8SgpO6QbuR5Xsg8uFiHosA1X0PB9hz0JbZeWWUm5LPJzhLAP6S8gVf+TY0syif3qrgu+hzK8Psc8CfVdeVyy0IdrIzibocmGwlkz/BAuK6gIxfY99w1pfsbLusvHoSMuzVvAHvvn+danQqs4vnRL/4f+H7FMHvZ', /* required */
//       // AvailabilityZone: 'eu-central-1'
//     };
//     ec2instance.sendSSHPublicKey(params, function (err, data) {
//       if (err) {console.log(err, err.stack)} // an error occurred
//       else     {console.log("data");console.log(data);console.log("data")};           // successful response
//     });

//   }

// });


const app = express();
const apiRouter = express.Router();


app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', "*");
    res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
})

app.use(express.json({limit: '25mb'}));
app.use(helmet());
app.use(cors({ origin: clientOrigins }));
app.use(express.json());

app.use("/api", apiRouter);

// apiRouter.use("/messages", messagesRouter);

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(500).send(err.message);
});

app.listen(serverPort, () => {
  console.log(`API Server listening on port ${serverPort}`);
});

app.get('/check',function (req,res){
  console.log("running")
  res.send("ok")
}
)
// app.get('/animationsList/:username',function (req, res) {
//   console.log(req);
//   let json_files_list = [];
//   const username = req.params.username

//   files = fs.readdirSync(__dirname+"/"+username+"/animations")
//   files.forEach(file => {
//       if (path.extname(file) == ".json")
//         json_files_list.push(path.basename(file,".json"));
//     })
//   var filenames_list = JSON.stringify(json_files_list)
//   console.log(filenames_list)
//   res.send(filenames_list)
// })

app.get('/animationsList/:username',function (req, res) {
  const username = req.params.username
  console.log(username)
  var params = {
    IndexName: "userID-index",

    ExpressionAttributeValues: {
      ':u': {S: username},
      ':d': {BOOL: false},
      ':t': {S: "row"}
    },
    KeyConditionExpression: 'userID = :u',
    ProjectionExpression: 'animationId,animationName',
    FilterExpression: 'isDeleted = :d and formatType=:t',
    TableName: dynamodbTableName
  };
  var dddd = []
    dynamodb.query(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      dddd = data
    }
    let names = dddd["Items"].map((x)=>(x["animationName"]["S"]))
    let ids = dddd["Items"].map((x)=>(x["animationId"]["S"]))
    let animationsList = {"ids":ids, "names":names}
    res.send(JSON.stringify(animationsList))
  });
})

// app.post('/saveAnimation',checkJwt,(request, response)=>{
//   var data = JSON.stringify(request.body)
//   var data_str = JSON.parse(data)
//   var username = data_str["username"]
//   console.log(data_str)

//   var name = data_str["name"]
//   console.log(name)

//   if (!fs.existsSync(username)){
//     fs.mkdirSync(username)
//     console.log(username)

//   }
//   var animation_path = `${username}/animations`
//   if (!fs.existsSync(animation_path)){
//     fs.mkdirSync(animation_path)
//   }
//   fs.writeFile(`${animation_path}/${name}.json`, data, function (err) {
//   if (err) return console.log(err);
//   });

//   if (!fs.existsSync(`${username}/thumbnailFrames`)){
//     fs.mkdirSync(`${username}/thumbnailFrames`)
//   }
//   makeThumbnail(`${username}/thumbnailFrames/${data_str["name"]}`,data_str["ThumbnailFrame"])
// })

app.post('/saveAnimation',(request, response)=>{
  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  var userID = data_str["userID"]
  var isDeleted = data_str["isDeleted"]
  var formatType = data_str["formatType"]
  var name = data_str["name"]
  var frames = JSON.stringify(data_str["data"])
  var animationId = String(Date.now())

  var params = {
    TableName: dynamodbTableName,
    Item: {
      'animationName' : {S: name},
      'userName':{S: userID},
      'userID' : {S: userID},
      'animationId':{S: animationId},
      'frames':{S: frames},
      'isDeleted':{BOOL: isDeleted},
      'formatType':{S: formatType}
    }
  };
    dynamodb.putItem(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success", data);
    }
  });

  // makeThumbnail(`${username}/thumbnailFrames/${data_str["name"]}`,data_str["ThumbnailFrame"])
})


// app.get('/loadAnimation/:username/:filename',checkJwt, function (req, res) {
//   let json_files_list = [];
//   console.log("FFFFFF")
//   const username = req.params.username
//   const filename = req.params.filename

//   console.log(username)
//   console.log(__dirname+`/${username}/animations/${filename}.json`)


//   var data = fs.readFileSync(__dirname+`/${username}/animations/${filename}.json`)
//   var data_str = JSON.parse(data)
//   res.send(data_str)
// })

// app.get('/loadAnimation/:filename',checkJwt, function (req, res) {
app.get('/loadAnimation/:filename', function (req, res) {

  const filename = req.params.filename
  var params = {
    ExpressionAttributeValues: {
      ':u': {S: filename},
    },
    KeyConditionExpression: 'animationId = :u',
    ProjectionExpression: 'frames',
    TableName: dynamodbTableName
  };
  var dddd = []
    dynamodb.query(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      dddd = data
    }
    // console.log(dddd["Items"][0]["frames"])
    let animation = {"data":JSON.parse(dddd["Items"][0]["frames"]["S"]),"id":filename}
    res.send(JSON.stringify(animation))
  });

  // var data = fs.readFileSync(__dirname+`/${username}/animations/${filename}.json`)
  // var data_str = JSON.parse(data)
  // res.send(data_str)
})

app.get('/thumbnail/:filename/:username',checkJwt, function (req, res) {
  const filename = req.params.filename
  const username = req.params.username
  var thumbnailsPath = __dirname+`/${username}/thumbnailFrames`
    res.sendFile(`/${thumbnailsPath}/${filename}.png`);
})

// app.post('/gif',checkJwt,(request, response)=>{
app.post('/gif',(request, response)=>{

  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  console.log("*******")
  var username = data_str["username"]
  var username = data_str["username"]

  var name = data_str["name"]
  console.log("name is:" +name)
  var speed = data_str["speed"]
  console.log(`speed is:${speed}`)
  var frames = data_str["data"]
  let num_files = frames.length
  console.log("number of frames is:"+ num_files)


  var gifs_path = `${username}/extracted_gifs`

  if (!fs.existsSync(username)){
    fs.mkdirSync(username)
  }
  if (!fs.existsSync(gifs_path)){
    console.log(gifs_path)
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
          console.log("READY")
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
