const {json, send} = require('micro')
const coordEach = require('@turf/meta').coordEach;
const TileSet = require('node-hgt').TileSet
const ImagicoElevationDownloader = require('node-hgt').ImagicoElevationDownloader
const tileDirectory = process.env.TILE_DIRECTORY || './data'
const noData = process.env.NO_DATA ? parseInt(process.env.NO_DATA) : null
const tileDownloader = process.env.TILE_DOWNLOADER === 'none'
  ? tileDownloader = undefined
  : new ImagicoElevationDownloader(tileDirectory)
const maxPostSize = process.env.MAX_POST_SIZE || "500kb";
const tiles = new TileSet(tileDirectory, {downloader:tileDownloader});

const addElevation = function(geojson, elevationProvider, cb, nodata) {
  var waiting = 0,
      allProcessed = false;

  coordEach(geojson, function(coords) {
      waiting++;

      elevationProvider.getElevation([coords[1], coords[0]], function(err, elevation) {
          if (err) {
              if (nodata != null) {
                  coords[2] = nodata;
                  waiting--;
              } else {
                  cb(err);
                  waiting = -1;
              }
          } else {
              coords[2] = elevation;
              waiting--;
          }

          if (allProcessed && waiting === 0) {
              cb(undefined, geojson);
          }
      });
  });

  allProcessed = true;
  if (waiting === 0) {
      cb(undefined, geojson);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return send(res, 405, {error: 'Only POST allowed'})
  }

  const geojson = await json(req, {limit: maxPostSize})
  console.log(geojson)
  if (!geojson || Object.keys(geojson).length === 0) {
    return send(res, 400, {error: 'invalid GeoJSON'})
  }

  return new Promise((resolve, reject) => {
    addElevation(geojson, tiles, function(err, geojson) {
      console.log(err, geojson)
      if (err) {
        return send(res, 500, err)
      }

      resolve(geojson)
    }, noData)
  })
}
