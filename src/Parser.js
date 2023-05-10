function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);

    return [r, g, b, 240];
  }
  return null;
}
function colorPixel(c, r, rgb, data, size_frame, margin, pixel_size) {
  start_h = c * (margin + pixel_size);
  start_w = r * (margin + pixel_size);
  for (var y = start_h; y < start_h + pixel_size; y++) {
    for (var x = start_w; x < start_w + pixel_size; x++) {
      var idx = (size_frame * y + x) << 2;
      data[idx] = rgb[0]; // red
      data[idx + 1] = rgb[1]; // green
      data[idx + 2] = rgb[2]; // blue
      data[idx + 3] = rgb[3]; // alpha (0 is transparent)
    }
  }
}

createFixedFrame = (size_frame, rgb) => {
  const data = [];
  for (let i = 0; i < size_frame * size_frame; i++) {
    data.concat([rgb[0], rgb[1], rgb[2], rgb[3]]);
  }
  return data;
};

function Parser(frame) {
  const pixel_size = 10;
  const margin = 1;
  const num_pixels = frame.length;
  console.log("num_pixels", num_pixels);
  const size_frame = pixel_size * num_pixels + 2 * margin * (num_pixels + 1);
  const data = createFixedFrame(size_frame, [0, 0, 0, 240]);
  console.log("data", data);

  for (let i = 0; i < frame.length; i++) {
    for (let j = 0; j < frame[i].length; j++) {
      let rgb = hexToRgb(frame[j][i]);
      colorPixel(i, j, rgb, data, size_frame, margin, pixel_size);
    }
  }
  return data;
}
module.exports.Parser = Parser;
