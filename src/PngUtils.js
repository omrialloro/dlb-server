const fs = require('fs')
const PNG = require('pngjs').PNG;

function makePngs(name,frames){
    let margin = 0;
    let brick_dim = [10, 10];
    num_rows = 30
    num_cols = 30

    let w = num_rows*(brick_dim[1]+margin)+margin
    let h = num_cols*(brick_dim[0]+margin)+margin

    fs.mkdirSync(name)

    for (let i = 0;i<frames.length;i++){
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

        // function colorBrick(c,r,rgb){
        //     start_h = c*(margin + brick_dim[0])
        //     start_w = r*(margin + brick_dim[1])
        //     for (var y = start_h; y < start_h + brick_dim[0]; y++) {
        //         for (var x = start_w ; x < start_w+brick_dim[1]; x++) {
        //             var idx = (png.width * y + x) << 2;
        //             png.data[idx  ] = rgb[0]; // red
        //             png.data[idx+1] = rgb[1]; // green
        //             png.data[idx+2] = rgb[2]; // blue
        //             png.data[idx+3] = rgb[3]; // alpha (0 is transparent)
        //         }
        //     }
        // }
        for (let r = 0; r < num_rows; r++) {
            for (let c = 0; c < num_cols;  c++){
                rgb = hexToRgb(frame[r][c])
                colorBrick(c,r,rgb,png,margin,brick_dim)
            }
        }
        png.pack().pipe(fs.createWriteStream(`${name}/${i}.png`));

    }
    return null;
}

function makeFrame(pathName,frame,margin,brick_dim,num_rows,num_cols){

    let w = num_rows*(brick_dim[1]+margin)+margin
    let h = num_cols*(brick_dim[0]+margin)+margin
    console.log(w)
    console.log(h)


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
    console.log(frame)


    for (let r = 0; r < num_rows; r++) {
      for (let c = 0; c < num_cols;  c++){
        rgb = hexToRgb(frame[r][c])
        colorBrick(c,r,rgb,png,margin,brick_dim)
      }
    }
    png.pack().pipe(fs.createWriteStream(`${pathName}.png`));

    return null;
  }


  function makeThumbnail( pathName,frame) {
    let margin = 0;
    let brick_dim = [2,2];
    let num_rows = frame[0].length;
    let num_cols = frame.length;
    makeFrame(pathName,frame,margin,brick_dim,num_rows,num_cols)

  }


function colorBrick(c,r,rgb,png,margin,brick_dim){
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

module.exports.makePngs = makePngs;

module.exports.makeThumbnail = makeThumbnail
