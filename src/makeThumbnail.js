const os = require('os')
const path = require('path')
const fs = require('fs')
const PNG = require('pngjs').PNG;


function makeFrame(name, frame){

  let margin = 0;
  let brick_dim = [2, 2];
  num_rows = 30
  num_cols = 30

  let w = num_rows*(brick_dim[1]+margin)+margin
  let h = num_cols*(brick_dim[0]+margin)+margin

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
      rgb = hexToRgb(frame[r][c])
      colorBrick(c,r,rgb)
    }
  }
  png.pack().pipe(fs.createWriteStream(`${name}.png`));

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

function PrepareThumbnails(folder_in, folder_out){
  const files_list = fs.readdirSync(folder_in)
  const files_list_json = files_list.filter(file => {
    return path.extname(file).toLowerCase() === ".json";
  });
  console.log(files_list_json)


  files_list_json.forEach((filename, i) => {
    var data = fs.readFileSync(`${folder_in}/${filename}`)
    var data_str = JSON.parse(data)
    let frame_index = 0;
    if(data_str.hasOwnProperty("representative_frame")){
      frame_index = data_str["representative_frame"];

    }
    let name = path.parse(filename).name
    let frame = data_str["data"][frame_index]
    makeFrame(`${folder_out}/${name}`, frame)
  });


}

PrepareThumbnails("animations","outFrames")
