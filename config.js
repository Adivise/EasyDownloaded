module.exports = {
    songsFolder: "C:/Users/Snowf/AppData/Local/osu!/Songs", // path of your osu songs folder like | C:/Adivise/osu!/Songs
    downloadMaxed: 50, // how much beatmap your need to download | it not correctly 100 beatmap *iam lazy to code that*

    /// for osu! beatmap filters
    apiKey: "FILL_HERE", // osu!apikey your can get in osu!website
    mode: 0, // mode to download | 0 = Standard, 1 = Taiko, 2 = Catch to beat, 3 = Mania
    starRating_min: 5.00, // star min can set 5.69
    starRating_max: 8.00, // star max can set 7.27
    since: ["2022-01-01", "2021-01-01", "2020-01-01", "2019-01-01", "2018-01-01", "2017-01-01"], // beatmap since upload
}