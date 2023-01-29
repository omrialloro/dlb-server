

const http = require('http')
const os = require('os')
const path = require('path')
const fs = require('fs')
const PNG = require('pngjs').PNG;

// let json_files_list = [];
// files = fs.readdirSync("extracted_gifs")
// files.forEach(file => {
//     if (path.extname(file) == ".json")
//       // json_files_list.push(path.basename(file,".json"));
//       json_files_list.push("extracted_gifs/"+file);
//
//   })
//
// let d= fs.readFileSync(json_files_list[0]);
// d = json_files_list[32]
// let data = JSON.parse(d);
// console.log(json_files_list.length);
// // x= fs.readFileSync(json_files_list[19])
//
//
// frames = []
// for(let i = 0; i < json_files_list.length; i++){
//   console.log(i)
//   // console.log("length" + data["data"].length)
//   let x= fs.readFileSync(json_files_list[i]);
//   if (x.length>0){
//     let xx = JSON.parse(x)["data"];
//     frames = frames.concat(xx)
//     console.log(frames.length)
//   }
//   // console.log(data["data"].length)
// }
//
// name = String(Date.now())
// speed = 60
// makePngs(name,speed, frames)
// var spawn = require('child_process').spawn
// const tmot = setTimeout(()=>{
//   // console.log("suspicious!")
//   console.log('calling python...');
//
//   // clearInterval(intervalObj);
//   spawn('python3', ['convert_png.py',name, speed])
// },100000)
//


function makePngs(name,speed, frames){

let margin = 0;
let brick_dim = [10, 10];

num_rows = 30
num_cols = 30

let w = num_rows*(brick_dim[1]+margin)+margin
let h = num_cols*(brick_dim[0]+margin)+margin

fs.mkdirSync(name)

for (let i = 0;i<frames.length;i++){
  console.log("frame"+i)
  frame = frames[i]
var png = new PNG({
    width: w,
    height: h,
    filterType: -1
});

for (var y = 0; y < png.height; y++) {
    for (var x = 0; x < png.width; x++) {
        var idx = (png.width * y + x) << 2;
        png.data[idx  ] = 40; // red
        png.data[idx+1] = 30; // green
        png.data[idx+2] = 40; // blue
        png.data[idx+3] = 0; // alpha (0 is transparent)
    }
}

function colorBrick(c,r,rgb){
  start_h = c*(margin + brick_dim[0])
  start_w = r*(margin + brick_dim[1])
  for (var y = start_h; y < start_h + brick_dim[0]; y++) {
      for (var x = start_w ; x < start_w+brick_dim[1]; x++) {
          var idx = (png.width * y + x) << 2;
          png.data[idx  ] = rgb[0]; // red
          png.data[idx+1] = rgb[1]; // green
          png.data[idx+2] = rgb[2]; // blue
          png.data[idx+3] = rgb[3]; // alpha (0 is transparent)
      }
  }
}

for (let r = 0; r < num_rows; r++) {
  for (let c = 0; c < num_cols;  c++){
    console.log("***")
    console.log("frame"+i)

    console.log(c)
    console.log(r)
    console.log("***")
    rgb = hexToRgb(frame[r][c])
    colorBrick(c,r,rgb)
  }
}
png.pack().pipe(fs.createWriteStream(`${name}/${i}.png`));


}
return null;
}


function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if(result){
      var r= parseInt(result[1], 16);
      var g= parseInt(result[2], 16);
      var b= parseInt(result[3], 16);
      return [r,g,b,240]
  }
  return null;
}


function rgbToH(r, g, b) {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

var data = fs.readFileSync(`xxx.json`)

var data_str = JSON.parse(data)
console.log("*******")
var name = data_str["name"]
console.log("name is:"+name)
var speed = data_str["speed"]
console.log(`speed is:${speed}`)
var frames = data_str["data"]
let num_files = frames.length
console.log("number of frames is:"+ num_files)


makePngs(name,speed, frames)
