function hexToRgb(hex, alpha) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    var r = parseInt(result[1], 16);
    var g = parseInt(result[2], 16);
    var b = parseInt(result[3], 16);
    return { r: r, g: g, b: b, a: Math.round(alpha * 255) };
  }
  return null;
}

function blendPixel(data, width, x, y, newColor) {
  const { r: newR, g: newG, b: newB, a: newA } = newColor;
  const idx = (width * y + x) << 2;
  // Existing color values
  const existingR = data[idx];
  const existingG = data[idx + 1];
  const existingB = data[idx + 2];
  const existingA = data[idx + 3] / 255;

  // Normalized alpha values
  const alphaNew = newA / 255;
  const alphaExisting = existingA;

  // Compute the blended alpha
  const outAlpha = alphaNew + alphaExisting * (1 - alphaNew);

  // Compute the blended RGB values
  const outR = Math.round(
    (newR * alphaNew + existingR * alphaExisting * (1 - alphaNew)) / outAlpha
  );
  const outG = Math.round(
    (newG * alphaNew + existingG * alphaExisting * (1 - alphaNew)) / outAlpha
  );
  const outB = Math.round(
    (newB * alphaNew + existingB * alphaExisting * (1 - alphaNew)) / outAlpha
  );
  // Update the pixel with the blended color
  data[idx] = outR;
  data[idx + 1] = outG;
  data[idx + 2] = outB;
  data[idx + 3] = Math.round(outAlpha * 255);
}

function drawFilledRoundedRectangle(
  data,
  width,
  x,
  y,
  widthP,
  heightP,
  radiusP,
  color
) {
  const radiusW = (widthP * radiusP) / 2;
  const radiusH = (heightP * radiusP) / 2;
  const radius = Math.min(radiusH, radiusW);

  // Fill the rectangle body, including the area around the rounded corners
  for (let i = x; i < x + widthP; i++) {
    for (let j = y; j < y + heightP; j++) {
      // Check if the pixel is outside the rounded corners
      const withinTopLeftCorner =
        i < x + radius &&
        j < y + radius &&
        (i - x - radius) ** 2 + (j - y - radius) ** 2 > radius ** 2;
      const withinTopRightCorner =
        i >= x + widthP - radius &&
        j < y + radius &&
        (i - (x + widthP - 1) + radius) ** 2 + (j - y - radius) ** 2 >
          radius ** 2;
      const withinBottomLeftCorner =
        i < x + radius &&
        j >= y + heightP - radius &&
        (i - x - radius) ** 2 + (j - (y + heightP - 1) + radius) ** 2 >
          radius ** 2;
      const withinBottomRightCorner =
        i >= x + widthP - radius &&
        j >= y + heightP - radius &&
        (i - (x + widthP - 1) + radius) ** 2 +
          (j - (y + heightP - 1) + radius) ** 2 >
          radius ** 2;

      if (
        !withinTopLeftCorner &&
        !withinTopRightCorner &&
        !withinBottomLeftCorner &&
        !withinBottomRightCorner
      ) {
        blendPixel(data, width, i, j, color);
      }
    }
  }
}

createFixedFrame = (size_x, size_y, rgb) => {
  let n = size_x * size_y;
  const data = Array(4 * n).fill(0);
  for (let i = 3; i < 4 * n; i = i + 4) {
    data[i] = 255;
  }
  return data;
};

function FrameParser(frame, width, height, pixelData) {
  const l_x = frame.length;
  const l_y = frame[0].length;
  const pixelWidth = width / l_x;
  const pixelHeight = height / l_y;
  const { radius, opacity, pw, ph } = pixelData;

  const data = createFixedFrame(width, height, [0, 0, 0, 240]);

  for (let i = 0; i < l_x; i++) {
    for (let j = 0; j < l_y; j++) {
      let color = hexToRgb(frame[i][j], opacity);
      start_h = j * pixelHeight;
      start_w = i * pixelWidth;
      drawFilledRoundedRectangle(
        data,
        width,
        start_w,
        start_h,
        pixelWidth * pw,
        pixelHeight * ph,
        radius,
        color
      );
    }
  }
  return data;
}

function testFrameParser(filePath) {
  const data = fs.readFileSync(filePath, "utf8");
  const frames = JSON.parse(data);

  const l_x = frames[0].length;
  const l_y = frames[0][0].length;

  const width_ = 321;
  const height_ = 321;

  const width = width_ - (width_ % l_x);
  const height = height_ - (height_ % l_y);
  const encoder = new GIFEncoder(width, height);

  const fileStream = fs.createWriteStream("output.gif");

  encoder.createReadStream().pipe(fileStream);
  const delay = 20;

  encoder.start();
  encoder.setRepeat(0); // 0 for repeat, -1 for no-repeat
  encoder.setDelay(delay); // frame delay in ms
  encoder.setQuality(20); //

  const pixelData = { radius: 0, opacity: 1, pw: 1, ph: 1 };

  for (let i = 0; i < frames.length; i++) {
    try {
      encoder.addFrame(FrameParser(frames[i], width, height, pixelData));
    } catch (error) {
      console.log(error);
    }
  }
  encoder.finish();
}
// const GIFEncoder = require("./GIFEncoder");
// const fs = require("fs");

// testFrameParser("1675355321382.json");

module.exports.FrameParser = FrameParser;
