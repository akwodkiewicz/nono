// src/ocr/raster.ts
function downscaleRgba(image, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
  if (scale === 1) return image;
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y / scale);
    const sy1 = Math.min(image.height, Math.max(sy0 + 1, Math.floor((y + 1) / scale)));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x / scale);
      const sx1 = Math.min(image.width, Math.max(sx0 + 1, Math.floor((x + 1) / scale)));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const o2 = (sy * image.width + sx) * 4;
          r += image.data[o2];
          g += image.data[o2 + 1];
          b += image.data[o2 + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}
function grayscale(image) {
  const { data, width, height } = image;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = Math.round(0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]);
  }
  return gray;
}
function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[v]++;
  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let sumBg = 0;
  let weightBg = 0;
  let bestVariance = -1;
  let bestThreshold = 127;
  for (let t = 0; t < 256; t++) {
    weightBg += hist[t];
    if (weightBg === 0) continue;
    const weightFg = total - weightBg;
    if (weightFg === 0) break;
    sumBg += t * hist[t];
    const meanBg = sumBg / weightBg;
    const meanFg = (sumAll - sumBg) / weightFg;
    const variance = weightBg * weightFg * (meanBg - meanFg) ** 2;
    if (variance > bestVariance) {
      bestVariance = variance;
      bestThreshold = t;
    }
  }
  return bestThreshold;
}
function binarize(gray, width, height, threshold) {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    data[i] = gray[i] <= threshold ? 1 : 0;
  }
  return { data, width, height };
}
function adaptiveBinarize(gray, width, height, radius, k = 0.15) {
  const iw = width + 1;
  const integral = new Float64Array(iw * (height + 1));
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
    }
  }
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const area = (x1 - x0) * (y1 - y0);
      const sum = integral[y1 * iw + x1] - integral[y0 * iw + x1] - integral[y1 * iw + x0] + integral[y0 * iw + x0];
      const mean = sum / area;
      data[y * width + x] = gray[y * width + x] < mean * (1 - k) ? 1 : 0;
    }
  }
  return { data, width, height };
}
function floodFill(data, visited, stack, width, height, start) {
  let top = 0;
  stack[top++] = start;
  visited[start] = 1;
  const pixels = [];
  let x0 = width;
  let x1 = -1;
  let y0 = height;
  let y1 = -1;
  while (top > 0) {
    const idx = stack[--top];
    pixels.push(idx);
    const x = idx % width;
    const y = (idx - x) / width;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
    if (x > 0 && data[idx - 1] && !visited[idx - 1]) {
      visited[idx - 1] = 1;
      stack[top++] = idx - 1;
    }
    if (x < width - 1 && data[idx + 1] && !visited[idx + 1]) {
      visited[idx + 1] = 1;
      stack[top++] = idx + 1;
    }
    if (y > 0 && data[idx - width] && !visited[idx - width]) {
      visited[idx - width] = 1;
      stack[top++] = idx - width;
    }
    if (y < height - 1 && data[idx + width] && !visited[idx + width]) {
      visited[idx + width] = 1;
      stack[top++] = idx + width;
    }
  }
  return { pixels, x0, y0, x1, y1 };
}
function keepDigitLikeComponents(bmp, options = {}) {
  const { width, height } = bmp;
  const minArea = options.minArea ?? 8;
  const maxGlyph = options.maxGlyphSize ?? Math.max(24, Math.round(Math.min(width, height) * 0.12));
  const { gray } = options;
  const data = new Uint8Array(bmp.data);
  const visited = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let darkData = null;
  let darkVisited = null;
  const isDigitLike = (c) => {
    const w = c.x1 - c.x0 + 1;
    const h = c.y1 - c.y0 + 1;
    if (c.pixels.length < minArea) return false;
    if (w > maxGlyph || h > maxGlyph) return false;
    if (w > 3 * h && w > 0.7 * maxGlyph || h > 3 * w && h > 0.7 * maxGlyph) return false;
    if (w > 6 * h || h > 6 * w) return false;
    return true;
  };
  let printThreshold = null;
  const getPrintThreshold = () => {
    if (printThreshold === null) {
      const inkGrays = [];
      for (let i = 0; i < bmp.data.length; i++) {
        if (bmp.data[i]) inkGrays.push(gray[i]);
      }
      printThreshold = otsuThreshold(Uint8Array.from(inkGrays));
    }
    return printThreshold;
  };
  for (let start = 0; start < data.length; start++) {
    if (!data[start] || visited[start]) continue;
    const component = floodFill(data, visited, stack, width, height, start);
    if (isDigitLike(component)) continue;
    for (const idx of component.pixels) data[idx] = 0;
    const w = component.x1 - component.x0 + 1;
    const h = component.y1 - component.y0 + 1;
    const tooBig = w > maxGlyph || h > maxGlyph;
    const blobLike = Math.min(w, h) > maxGlyph * 0.5;
    if (!tooBig || !blobLike || !gray || component.pixels.length < minArea) {
      continue;
    }
    const threshold = getPrintThreshold();
    darkData ??= new Uint8Array(width * height);
    darkVisited ??= new Uint8Array(width * height);
    let darkCount = 0;
    for (const idx of component.pixels) {
      if (gray[idx] <= threshold) {
        darkData[idx] = 1;
        darkCount++;
      }
    }
    if (darkCount >= minArea && darkCount < component.pixels.length) {
      for (const idx of component.pixels) {
        if (!darkData[idx] || darkVisited[idx]) continue;
        const sub = floodFill(darkData, darkVisited, stack, width, height, idx);
        if (isDigitLike(sub)) {
          for (const subIdx of sub.pixels) data[subIdx] = 1;
        }
      }
    }
    for (const idx of component.pixels) {
      darkData[idx] = 0;
      darkVisited[idx] = 0;
    }
  }
  return { data, width, height };
}
function projectRows(bmp) {
  const proj = new Array(bmp.height).fill(0);
  for (let y = 0; y < bmp.height; y++) {
    let sum = 0;
    const off = y * bmp.width;
    for (let x = 0; x < bmp.width; x++) sum += bmp.data[off + x];
    proj[y] = sum;
  }
  return proj;
}
function projectCols(bmp) {
  const proj = new Array(bmp.width).fill(0);
  for (let y = 0; y < bmp.height; y++) {
    const off = y * bmp.width;
    for (let x = 0; x < bmp.width; x++) proj[x] += bmp.data[off + x];
  }
  return proj;
}
function maxRunInRow(bmp, y) {
  let max = 0;
  let run = 0;
  const off = y * bmp.width;
  for (let x = 0; x < bmp.width; x++) {
    run = bmp.data[off + x] ? run + 1 : 0;
    if (run > max) max = run;
  }
  return max;
}
function maxRunInCol(bmp, x) {
  let max = 0;
  let run = 0;
  for (let y = 0; y < bmp.height; y++) {
    run = bmp.data[y * bmp.width + x] ? run + 1 : 0;
    if (run > max) max = run;
  }
  return max;
}
function removeGridLines(bmp, coverage = 0.5) {
  const data = new Uint8Array(bmp.data);
  const { width, height } = bmp;
  for (let y = 0; y < height; y++) {
    if (maxRunInRow(bmp, y) >= width * coverage) data.fill(0, y * width, (y + 1) * width);
  }
  for (let x = 0; x < width; x++) {
    if (maxRunInCol(bmp, x) >= height * coverage) {
      for (let y = 0; y < height; y++) data[y * width + x] = 0;
    }
  }
  return { data, width, height };
}
function cropBitmap(bmp, x, y, w, h) {
  const data = new Uint8Array(w * h);
  for (let row = 0; row < h; row++) {
    const src = (y + row) * bmp.width + x;
    data.set(bmp.data.subarray(src, src + w), row * w);
  }
  return { data, width: w, height: h };
}

// src/ocr/segment.ts
function findBands(projection, minInk, mergeGap, minSize) {
  const runs = [];
  let start = -1;
  for (let i = 0; i < projection.length; i++) {
    if (projection[i] > minInk) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      runs.push({ start, end: i });
      start = -1;
    }
  }
  if (start >= 0) runs.push({ start, end: projection.length });
  const merged = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (prev && run.start - prev.end <= mergeGap) {
      prev.end = run.end;
    } else {
      merged.push({ ...run });
    }
  }
  return merged.filter((span) => span.end - span.start >= minSize);
}
function prepareCluePhoto(bin, orientation, gray) {
  let x0 = 0;
  let y0 = 0;
  let x1 = bin.width;
  let y1 = bin.height;
  const margin = 3;
  if (orientation === "rows") {
    for (let x = Math.floor(bin.width * 0.4); x < bin.width; x++) {
      if (maxRunInCol(bin, x) >= bin.height * 0.5) {
        x1 = Math.max(1, x - margin);
        break;
      }
    }
  } else {
    for (let y = Math.floor(bin.height * 0.35); y < bin.height; y++) {
      if (maxRunInRow(bin, y) >= bin.width * 0.5) {
        y1 = Math.max(1, y - margin);
        break;
      }
    }
    for (let y = Math.floor(bin.height * 0.3); y >= 0; y--) {
      if (maxRunInRow(bin, y) >= bin.width * 0.2) {
        y0 = Math.min(y1 - 1, y + margin + 1);
        break;
      }
    }
  }
  const uncropped = x0 === 0 && y0 === 0 && x1 === bin.width && y1 === bin.height;
  const cropped = uncropped ? bin : cropBitmap(bin, x0, y0, x1 - x0, y1 - y0);
  const croppedGray = gray && !uncropped ? cropBitmap({ data: gray, width: bin.width, height: bin.height }, x0, y0, x1 - x0, y1 - y0).data : gray;
  return keepDigitLikeComponents(cropped, { gray: croppedGray });
}
function dropTinyTokens(lines, minRatio = 0.45) {
  const heights = lines.flat().map((box) => box.h).sort((a, b) => a - b);
  if (heights.length === 0) return lines;
  const median = heights[Math.floor(heights.length / 2)];
  return lines.map((tokens) => tokens.filter((box) => box.h >= median * minRatio)).filter((tokens) => tokens.length > 0);
}
function tightYBounds(bmp, box) {
  let y0 = box.y + box.h;
  let y1 = box.y;
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) {
      if (bmp.data[y * bmp.width + x]) {
        if (y < y0) y0 = y;
        if (y >= y1) y1 = y + 1;
        break;
      }
    }
  }
  return y1 > y0 ? { x: box.x, y: y0, w: box.w, h: y1 - y0 } : box;
}
function tightXBounds(bmp, box) {
  let x0 = box.x + box.w;
  let x1 = box.x;
  for (let x = box.x; x < box.x + box.w; x++) {
    for (let y = box.y; y < box.y + box.h; y++) {
      if (bmp.data[y * bmp.width + x]) {
        if (x < x0) x0 = x;
        if (x >= x1) x1 = x + 1;
        break;
      }
    }
  }
  return x1 > x0 ? { x: x0, y: box.y, w: x1 - x0, h: box.h } : box;
}
function segmentCluePhoto(bmp, orientation) {
  if (orientation === "rows") {
    const noise2 = Math.max(1, Math.round(bmp.width * 3e-3));
    const bands = findBands(projectRows(bmp), noise2, 3, 4);
    return dropTinyTokens(
      bands.map((band) => {
        const bandH = band.end - band.start;
        const sub = cropBitmap(bmp, 0, band.start, bmp.width, bandH);
        const digitGap = Math.max(2, Math.round(bandH * 0.35));
        const tokens = findBands(projectCols(sub), 0, digitGap, 2);
        return tokens.map(
          (t) => tightYBounds(bmp, { x: t.start, y: band.start, w: t.end - t.start, h: bandH })
        );
      })
    );
  }
  const noise = Math.max(1, Math.round(bmp.height * 3e-3));
  const strips = findBands(projectCols(bmp), noise, 3, 4);
  return dropTinyTokens(
    strips.map((strip) => {
      const stripW = strip.end - strip.start;
      const sub = cropBitmap(bmp, strip.start, 0, stripW, bmp.height);
      const tokens = findBands(projectRows(sub), 0, 3, 2);
      return tokens.map(
        (t) => tightXBounds(bmp, { x: strip.start, y: t.start, w: stripW, h: t.end - t.start })
      );
    })
  );
}
export {
  adaptiveBinarize,
  binarize,
  cropBitmap,
  downscaleRgba,
  findBands,
  grayscale,
  keepDigitLikeComponents,
  maxRunInCol,
  maxRunInRow,
  otsuThreshold,
  prepareCluePhoto,
  projectCols,
  projectRows,
  removeGridLines,
  segmentCluePhoto
};
