# YouTube Music Downloader

Self-explainatory title

## Installation

```sh
npm install youtube-music-dl
```

## Usage

```js
import ytMusicDl from "youtube-music-dl";

ytMusicDl("dQw4w9WgXcQ", { saveMetadata: true, showLogs: true }).then(
    (data) => {
        const buffer = Buffer.from(data);
        fs.writeFileSync("test.mp3", buffer);
    }
);
```

## Credits

Huge thanks to

- <https://github.com/fent/node-ytdl-core>
- <https://github.com/egoroof/browser-id3-writer>
