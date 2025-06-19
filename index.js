const { Downloader, DownloadEntry, DownloadType } = require('osu-downloader');
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
const { songsFolder, apiKey, starRating_max, starRating_min, mode, downloadMaxed, workers } = require("./config.js");

const PARALLEL_DOWNLOADERS = workers; // You can increase or decrease this number

async function main() {
  const beatmapSetObjs = await collectBeatmapSetIds(downloadMaxed);

  if (beatmapSetObjs.length === 0) {
    console.log("No beatmaps found matching criteria.");
    process.exit(1);
  }

  await downloadBeatmapsParallel(beatmapSetObjs, PARALLEL_DOWNLOADERS);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function collectBeatmapSetIds(maxCount) {
  const collected = new Map();
  let attempts = 0;

  function getRandomSinceDate(startYear = 2010, startMonth = 1) {
    const now = new Date();
    const start = new Date(startYear, startMonth - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
    const randomDate = new Date(randomTime);
    const year = randomDate.getFullYear();
    const month = (randomDate.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}-01`;
  }

  while (collected.size < maxCount) {
    attempts++;
    try {
      // Generate 5 random since dates per attempt
      const sinceDates = Array.from({ length: 5 }, () => getRandomSinceDate(2010, 1));
      let allBeatmaps = [];
      for (const sinced of sinceDates) {
        const response = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${apiKey}&since=${sinced}`);
        const beatmaps = await response.json();
        if (Array.isArray(beatmaps)) {
          allBeatmaps = allBeatmaps.concat(beatmaps);
        }
      }

      // Shuffle the combined beatmaps
      const shuffled = shuffleArray(allBeatmaps);

      const filtered = shuffled.filter(x =>
        x.difficultyrating >= starRating_min &&
        x.difficultyrating <= starRating_max &&
        x.mode == mode &&
        x.approved > 0
      );

      for (const beatmap of filtered) {
        if (collected.size >= maxCount) break;
        const beatmapsetId = beatmap.beatmapset_id;
        const oszPath = path.join(songsFolder, `${beatmapsetId}.osz`);
        if (!fs.existsSync(oszPath)) {
          const name = `${beatmap.artist} - ${beatmap.title}`;
          collected.set(beatmapsetId, name);
        } else {
          // Optionally log skipped beatmaps
          console.log(`Skipping already existing beatmapset: ${beatmapsetId}`);
        }
      }

      console.log(`Attempt ${attempts}: Collected ${collected.size}/${maxCount} unique beatmap set IDs (excluding already existing).`);
      if (filtered.length === 0) {
        console.log("No beatmaps found in this batch, trying again...");
      }
    } catch (err) {
      console.error("Error fetching beatmaps:", err);
    }
  }

  // Return array of { id, name }
  return Array.from(collected.entries()).map(([id, name]) => ({ id, name }));
}

function roundRobinChunks(array, chunkCount) {
  const chunks = Array.from({ length: chunkCount }, () => []);
  array.forEach((item, idx) => {
    chunks[idx % chunkCount].push(item);
  });
  return chunks;
}

async function downloadBeatmapsParallel(beatmapSetObjs, parallelCount) {
  const chunks = roundRobinChunks(beatmapSetObjs, parallelCount).filter(chunk => chunk.length > 0);
  console.log(`Starting ${chunks.length} parallel downloaders...`);

  await Promise.all(
    chunks.map((chunk, idx) => downloadBeatmaps(chunk, idx + 1))
  );

  console.log("All downloads finished.");
  process.exit();
}

async function downloadBeatmaps(beatmapSetObjs, downloaderIndex = 1) {
  const downloader = new Downloader({
    rootPath: songsFolder,
    filesPerSecond: 0,
  });

  const startTime = Date.now();

  let lastFile = null;
  let lastProgress = '';
  let started = false;

  const interval = setInterval(() => {
    const { total, finished } = downloader.progress;
    let percent = 0;
    let finishedVal = typeof finished === 'number' ? finished : 0;
    let totalVal = typeof total === 'number' ? total : 0;

    if (!started) {
      if (beatmapSetObjs.length === 1) {
        const obj = beatmapSetObjs[0];
        console.log(`[Downloader ${downloaderIndex}] Starting to download: ${obj.id} - ${obj.name}`);
      } else if (beatmapSetObjs.length > 1) {
        const preview = beatmapSetObjs.slice(0, 3).map(obj => `${obj.id} - ${obj.name}`).join('; ');
        const more = beatmapSetObjs.length > 3 ? ` ...and ${beatmapSetObjs.length - 3} more` : '';
        console.log(`[Downloader ${downloaderIndex}] Starting to download ${beatmapSetObjs.length}: ${preview}${more}`);
      }
      started = true;
    }

    if (totalVal > 0) {
      percent = ((finishedVal / totalVal) * 100).toFixed(2);
      const progressStr = `${finishedVal}/${totalVal} (${percent}%)`;
      if (downloader.currentFile !== lastFile || progressStr !== lastProgress) {
        console.log(`[Downloader ${downloaderIndex}] ${progressStr} - Currently downloading file: ${downloader.currentFile}`);
        lastFile = downloader.currentFile;
        lastProgress = progressStr;
      }
    }
  }, 1000);

  const downloadEntries = beatmapSetObjs.map(obj =>
    new DownloadEntry({ id: obj.id, type: DownloadType.Set })
  );

  downloader.addMultipleEntries(downloadEntries);

  try {
    const result = await downloader.downloadAll();
    const endTime = Date.now();
    const timeTakenSec = ((endTime - startTime) / 1000).toFixed(2);

    // Print beatmap name for each set
    for (const obj of beatmapSetObjs) {
      const id = obj.id;
      const name = obj.name;
      const oszPath = path.join(songsFolder, `${id}.osz`);
      if (fs.existsSync(oszPath) && fs.lstatSync(oszPath).isFile()) {
        // console.log(`[Downloader ${downloaderIndex}] Downloaded: ${id} - ${name}`);
      } else {
        console.log(`[Downloader ${downloaderIndex}] .osz file does not exist: ${oszPath}`);
      }
    }

    // Final summary
    if (beatmapSetObjs.length === 1) {
      const obj = beatmapSetObjs[0];
      console.log(`[Downloader ${downloaderIndex}] Finished: ${obj.id} - ${obj.name}. Time taken: ${timeTakenSec} seconds.`);
    } else if (beatmapSetObjs.length > 1) {
      const preview = beatmapSetObjs.slice(0, 3).map(obj => `${obj.id} - ${obj.name}`).join('; ');
      const more = beatmapSetObjs.length > 3 ? ` ...and ${beatmapSetObjs.length - 3} more` : '';
      console.log(`[Downloader ${downloaderIndex}] Finished: ${preview}${more}. Time taken: ${timeTakenSec} seconds.`);
    } else {
      console.log(`[Downloader ${downloaderIndex}] Finished: 0 sets. Time taken: ${timeTakenSec} seconds.`);
    }
  } catch (err) {
    console.error(`[Downloader ${downloaderIndex}] Download failed:`, err);
  } finally {
    clearInterval(interval);
  }
}

main();