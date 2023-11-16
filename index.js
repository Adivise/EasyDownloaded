const { Downloader, DownloadEntry, DownloadType } = require('osu-downloader');
const fetch = require("node-fetch");
const { songsFolder, apiKey, since, starRating_max, starRating_min, mode, downloadMaxed } = require("./config.js");

let beatmapDL = [];
let i = 0;

const downloader = new Downloader({
    rootPath: songsFolder,
    filesPerSecond: 0,
});

setInterval(() => {
  console.log(`Currently download file: ${downloader.currentFile}`);
}, 1000);

repeatGetBeatmap(downloadMaxed).then(() => {
  downloadMap();
});

async function downloadMap() {
  const downloadEntries = beatmapDL.map(id => {
    return new DownloadEntry({
      id,
      type: DownloadType.Set,
    });
  });

  downloader.addMultipleEntries(downloadEntries);

  const result = await downloader.downloadAll(); // Download all files.
  console.log("Successfully Downloaded", result);

  // force stop when download finish
  
  process.exit();
}

async function repeatGetBeatmap(iterations) {
  for (let i = 0; i < iterations; i++) {
    await getBeatmap();

    // Check if we have reached 100 beatmaps, and if so, exit the loop
    if (beatmapDL.length > downloadMaxed) {
      break;
    }
  }
}

async function getBeatmap() {
  const sinced = since[Math.floor(Math.random() * since.length)];
  const response = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${apiKey}&since=${sinced}`);
  const beatmaps = await response.json();

  let filter = beatmaps.filter(x => x.difficultyrating >= starRating_min && x.difficultyrating <= starRating_max && x.mode == mode && x.approved > 0);

  filter.forEach((beatmap) => {
    const beatmapsetId = beatmap.beatmapset_id;

    if (!beatmapDL.includes(beatmapsetId)) {
      console.log(`Getting beatmap: (${i++}.) ${beatmapsetId}`);
      if (i === downloadMaxed) {
        downloadMap();
      } else {
        beatmapDL.push(beatmapsetId);
      }
    }
  });
}