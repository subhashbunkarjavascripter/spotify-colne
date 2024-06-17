import * as fs from "node:fs";
import ytMusicDl from "./index.js";

ytMusicDl("dQw4w9WgXcQ", { saveMetadata: true, showLogs: true }).then(
	(data) => {
		const buffer = Buffer.from(data);
		fs.writeFileSync("test.mp3", buffer);
	}
);
