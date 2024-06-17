import ffmpeg from "fluent-ffmpeg";
import { PassThrough } from "node:stream";

export const m4aToMp3 = (buffer) => {
	return new Promise((resolve, reject) => {
		try {
			const outputBuffers = [];
			const outputBufferStream = new PassThrough()
				.on("data", (buf) => {
					outputBuffers.push(buf);
				})
				.on("end", () => {
					const outputBuffer = Buffer.concat(outputBuffers);
					resolve(outputBuffer);
				});

			const inputBufferStream = new PassThrough().end(
				Buffer.from(buffer)
			);

			ffmpeg(inputBufferStream)
				.audioCodec("libmp3lame")
				.format("mp3")
				.writeToStream(outputBufferStream);
		} catch (err) {
			reject(err);
		}
	});
};
