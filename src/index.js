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
var   https = require('https')



const { clientOrigins, serverPort } = require("./config/env.dev");

// const { messagesRouter } = require("./messages/messages.router");

const { checkJwt } = require("./authz/check-jwt");
AWS.config.update({region:'eu-central-1'});

// const dynamodb = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var documentClient = new AWS.DynamoDB.DocumentClient();

const dynamodbTableName = 'animations';

const s3 = new AWS.S3()


const app = express();
const apiRouter = express.Router();
var options = {
  key: fs.readFileSync('private.key'),
  cert: fs.readFileSync('certificate.crt'),
};




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

// app.listen(serverPort, () => {
//   console.log(`API Server listening on port ${serverPort}`);
// });

var server = https.createServer(options, app).listen(serverPort, function(){
  console.log("Express server listening on port " + serverPort);
});

app.get('/check',function (req,res){
  console.log("running")
  res.send("ok")
}
)


app.get('/animationsList/:username/:flag',checkJwt,function (req, res) {
  const username = req.params.username
  const flag = req.params.flag
  if(flag=="row"){
    var params = {
      IndexName: "userID-index",
  
      ExpressionAttributeValues: {
        ':u': {S: username},
        ':d': {BOOL: false},
        ':t': {S: "row"},
        ':s': {BOOL: true},

      },
      KeyConditionExpression: 'userID = :u',
      ProjectionExpression: 'animationId,animationName',
      FilterExpression: 'isDeleted = :d and formatType=:t and saved=:s',
      TableName: dynamodbTableName
    };
  }
  else {
    var params = {
      IndexName: "userID-index",
  
      ExpressionAttributeValues: {
        ':u': {S: username},
        ':d': {BOOL: false},
        ':s': {BOOL: true},

      },
      KeyConditionExpression: 'userID = :u',
      ProjectionExpression: 'animationId,animationName',
      FilterExpression: 'isDeleted = :d and saved =:s',
      TableName: dynamodbTableName
    };
  }
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


app.post('/saveStoredAnimations',checkJwt,(request, response)=>{
  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  var userID = data_str["userID"]
  var data = JSON.stringify(data_str["data"])

  s3.putObject({
    Bucket: "dlb-thumbnails",
    Key: `storedAnimations/${userID}.json`,
    Body: data,
    ContentType:"application/json"

  }).promise()
})

app.get('/loadStoredAnimations/:userID',checkJwt, function (req, res) {
    const userID = req.params.userID
    var params = {Bucket:"dlb-thumbnails",Key: `storedAnimations/${userID}.json`}
    s3.getObject(params,function(err,data){
      if(err){
      }
      else {
        var data = JSON.parse(data.Body)
        res.send(JSON.stringify(data))
      }
    })
  
  })

app.post('/saveAnimation',checkJwt,(request, response)=>{
  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
  var userID = data_str["userID"]
  var isDeleted = data_str["isDeleted"]
  var formatType = data_str["formatType"]
  var IsSaved = data_str["saved"]
  var name = data_str["name"]
  var frames = JSON.stringify(data_str["data"])
  var animationId = String(Date.now())
  if(!IsSaved){
     animationId = name
  }

  console.log(animationId)
  var params = {
    TableName: dynamodbTableName,
    Item: {
      'animationName' : {S: name},
      'userName':{S: userID},
      'userID' : {S: userID},
      'animationId':{S: animationId},
      'isDeleted':{BOOL: isDeleted},
      'formatType':{S: formatType},
      'saved':{BOOL: IsSaved},
      'date':{S:String(Date.now())}
    }
  };
      dynamodb.putItem(params, function(err, data) {
    if (err) {
      console.log("Error", err);
    } else {
      console.log("Success");
    }
  });

  s3.putObject({
    Bucket: "dlb-thumbnails",
    Key: `frames/${animationId}.json`,
    Body: frames,
    ContentType:"application/json"

}).promise()

  // makeThumbnail(`${username}/thumbnailFrames/${data_str["name"]}`,data_str["ThumbnailFrame"])
  makeThumbnail(animationId, data_str["ThumbnailFrame"])  

  setTimeout(()=>{
    fs.readFile(`${animationId}.png`, (err, fileData) => {
      s3.putObject({
        Bucket: "dlb-thumbnails",
        Key: `${animationId}.png`,
        Body: fileData,
        ContentType:"image/png"
    
    }).promise()
    .then(()=>{
      setTimeout(()=>{
        fs.unlinkSync(`${animationId}.png`)
        console.log("NOwww")
      }
      ,20000)
    })
    
    });


  },1000)
})

app.get('/loadAnimation/:filename',checkJwt, function (req, res) {
// app.get('/loadAnimation/:filename', function (req, res) {

  const filename = req.params.filename
  var params = {Bucket:"dlb-thumbnails",Key:`frames/${filename}.json`}
  
  s3.getObject(params,function(err,data){
    if(err){
      res.send(JSON.stringify({"data":-1,"id":-1}))      
    }
    else {
      var animation = {"data":JSON.parse(data.Body),"id":filename}
      res.send(JSON.stringify(animation))
    }
  })

})


app.post('/markAsDeleted',checkJwt,(request, response)=>{
  var data_str = JSON.stringify(request.body)
  var data = JSON.parse(data_str)

  const markAsDeleted = async (id) => {
  
    const params = {
      TableName: dynamodbTableName,
      Key: {
        'animationId': id,
      },
      UpdateExpression: 'set isDeleted = :r',
      ExpressionAttributeValues: {
        ':r': true,
      },
    };
    
  
    await documentClient.update(params).promise();
  }
  for(let i=0;i<data.length;i++){
    markAsDeleted(data[i]);
  }
}
)

app.post('/deleteStoredAnimation',checkJwt,(request, response)=>{
  console.log("FFFFFF")
  console.log(request.body)
  let animationId = String(request.body["animationId"])
  console.log(animationId)
  var fileItem = {
    Key: {
      'animationId':{S:animationId}
    },
    TableName: dynamodbTableName,
};
  dynamodb.deleteItem(fileItem, function(err, data) {
    if (err) {
      console.log(err, err.stack);
    }
    else {
      console.log(data);
    }
  });

  s3.deleteObject({ Bucket: "dlb-thumbnails", Key: `frames/${animationId}.json` }).promise()

  // var data_str = JSON.stringify(request.body)
})


// app.post('/gif',checkJwt,(request, response)=>{
app.post('/gif',checkJwt,(request, response)=>{

  var data = JSON.stringify(request.body)
  var data_str = JSON.parse(data)
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
    return is_ready
  }
}

s3.putObject({
  Bucket: "dlb-thumbnails",
  Key: `tsffft.txt`,
  Body: `edeeefef`,
  ContentType:"text/plain"

}).promise()