// adapted from https://github.com/egoroof/browser-id3-writer/blob/master/src/ID3Writer.mjs

export default class ID3 {
	/**
	 * Create a new ID3 metadata instance
	 *
	 * @param {ArrayBuffer} buffer - the arraybuffer of the song you want to modify
	 */
	constructor(buffer) {
		if (
			!buffer ||
			typeof buffer !== "object" ||
			!("byteLength" in buffer)
		) {
			throw new Error(
				"First argument should be an instance of ArrayBuffer or Buffer"
			);
		}

		this.arrayBuffer = buffer;
		this.padding = 4096;
		this.frames = [];
	}
	/**
	 * A function to set different types of ID3 frames in a tag.
	 *
	 * @param {"TPE1" | "TIT2" | "TALB" | "TYER" | "APIC"} frameName - the name of the ID3 frame to set
	 * @param {string | string[] | object | number} frameValue - the value to set for the ID3 frame
	 * @return {this} - returns the current object to allow method chaining
	 */
	setFrame(frameName, frameValue) {
		switch (frameName) {
			// song artists
			case "TPE1": {
				if (!Array.isArray(frameValue)) {
					throw new Error(
						`${frameName} frame value should be an array of strings`
					);
				}
				const delemiter = frameName === "TCON" ? ";" : "/";
				const value = frameValue.join(delemiter);

				this._setStringFrame(frameName, value);
				break;
			}
			case "TIT2": // song title
			// album title
			case "TALB": {
				this._setStringFrame(frameName, frameValue);
				break;
			}
			// album release year
			case "TYER": {
				this._setIntegerFrame(frameName, frameValue);
				break;
			}
			// song cover
			case "APIC": {
				if (
					typeof frameValue !== "object" ||
					!("type" in frameValue) ||
					!("data" in frameValue) ||
					!("description" in frameValue)
				) {
					throw new Error(
						"APIC frame value should be an object with keys type, data and description"
					);
				}
				if (frameValue.type < 0 || frameValue.type > 20) {
					throw new Error("Incorrect APIC frame picture type");
				}
				this._setPictureFrame(
					frameValue.type,
					frameValue.data,
					frameValue.description,
					!!frameValue.useUnicodeEncoding
				);
				break;
			}
			default: {
				throw new Error(`Unsupported frame ${frameName}`);
			}
		}
		return this;
	}

	removeTag() {
		const headerLength = 10;

		if (this.arrayBuffer.byteLength < headerLength) {
			return;
		}
		const bytes = new Uint8Array(this.arrayBuffer);
		const version = bytes[3];
		const tagSize =
			uint7ArrayToUint28([bytes[6], bytes[7], bytes[8], bytes[9]]) +
			headerLength;

		if (!isId3v2(bytes) || version < 2 || version > 4) {
			return;
		}
		this.arrayBuffer = new Uint8Array(bytes.subarray(tagSize)).buffer;
	}

	/**
	 * Add tags to the buffer
	 *
	 * @return {ArrayBuffer} - The modified buffer
	 */
	addTag() {
		this.removeTag();

		const BOM = [0xff, 0xfe];
		const headerSize = 10;
		const totalFrameSize = this.frames.reduce(
			(sum, frame) => sum + frame.size,
			0
		);
		const totalTagSize = headerSize + totalFrameSize + this.padding;
		const buffer = new ArrayBuffer(
			this.arrayBuffer.byteLength + totalTagSize
		);
		const bufferWriter = new Uint8Array(buffer);

		let offset = 0;
		let writeBytes = [];

		writeBytes = [0x49, 0x44, 0x33, 3]; // ID3 tag and version
		bufferWriter.set(writeBytes, offset);
		offset += writeBytes.length;

		offset++; // version revision
		offset++; // flags

		writeBytes = uint28ToUint7Array(totalTagSize - headerSize); // tag size (without header)
		bufferWriter.set(writeBytes, offset);
		offset += writeBytes.length;

		for (const i in this.frames) {
			const frame = this.frames[i];
			writeBytes = encodeWindows1252(frame.name); // frame name
			bufferWriter.set(writeBytes, offset);
			offset += writeBytes.length;

			writeBytes = uint32ToUint8Array(frame.size - headerSize); // frame size (without header)
			bufferWriter.set(writeBytes, offset);
			offset += writeBytes.length;

			offset += 2; // flags

			switch (frame.name) {
				case "TPE1": // song artists
				case "TIT2": // song title
				// album title
				case "TALB": {
					writeBytes = [1].concat(BOM); // encoding, BOM
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;

					writeBytes = encodeUtf16le(frame.value); // frame value
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;
					break;
				}
				case "TYER": {
					offset++; // encoding

					writeBytes = encodeWindows1252(frame.value); // frame value
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;
					break;
				}
				case "APIC": {
					writeBytes = [frame.useUnicodeEncoding ? 1 : 0]; // encoding
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;

					writeBytes = encodeWindows1252(frame.mimeType); // MIME type
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;

					writeBytes = [0, frame.pictureType]; // separator, pic type
					bufferWriter.set(writeBytes, offset);
					offset += writeBytes.length;

					if (frame.useUnicodeEncoding) {
						writeBytes = [].concat(BOM); // BOM
						bufferWriter.set(writeBytes, offset);
						offset += writeBytes.length;

						writeBytes = encodeUtf16le(frame.description); // description
						bufferWriter.set(writeBytes, offset);
						offset += writeBytes.length;

						offset += 2; // separator
					} else {
						writeBytes = encodeWindows1252(frame.description); // description
						bufferWriter.set(writeBytes, offset);
						offset += writeBytes.length;

						offset++; // separator
					}

					bufferWriter.set(new Uint8Array(frame.value), offset); // picture content
					offset += frame.value.byteLength;
					break;
				}
			}
		}

		offset += this.padding; // free space for rewriting
		bufferWriter.set(new Uint8Array(this.arrayBuffer), offset);
		this.arrayBuffer = buffer;
		return buffer;
	}

	_setIntegerFrame(name, value) {
		const integer = Number.parseInt(value, 10);

		this.frames.push({
			name,
			value: integer,
			size: getNumericFrameSize(integer.toString().length),
		});
	}

	_setStringFrame(name, value) {
		const stringValue = value.toString();
		const size = getStringFrameSize(stringValue.length);

		this.frames.push({
			name,
			value: stringValue,
			size,
		});
	}

	_setPictureFrame(pictureType, data, description, useUnicodeEncoding) {
		let _useUnicodeEncoding = useUnicodeEncoding;
		const mimeType = getMimeType(new Uint8Array(data));
		const descriptionString = description.toString();

		if (!mimeType) {
			throw new Error("Unknown image MIME type");
		}
		if (!description) {
			_useUnicodeEncoding = false;
		}
		this.frames.push({
			name: "APIC",
			value: data,
			pictureType,
			mimeType,
			_useUnicodeEncoding,
			description: descriptionString,
			size: getPictureFrameSize(
				data.byteLength,
				mimeType.length,
				descriptionString.length,
				_useUnicodeEncoding
			),
		});
	}
}

const isId3v2 = (buf) => {
	return buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33;
};

const getMimeType = (buf) => {
	// https://github.com/sindresorhus/file-type
	if (!buf || !buf.length) {
		return null;
	}
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		buf[0] === 0x89 &&
		buf[1] === 0x50 &&
		buf[2] === 0x4e &&
		buf[3] === 0x47
	) {
		return "image/png";
	}
	if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
		return "image/gif";
	}
	if (
		buf[8] === 0x57 &&
		buf[9] === 0x45 &&
		buf[10] === 0x42 &&
		buf[11] === 0x50
	) {
		return "image/webp";
	}
	const isLeTiff =
		buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0;
	const isBeTiff =
		buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0 && buf[3] === 0x2a;

	if (isLeTiff || isBeTiff) {
		return "image/tiff";
	}
	if (buf[0] === 0x42 && buf[1] === 0x4d) {
		return "image/bmp";
	}
	if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
		return "image/x-icon";
	}
	return null;
};

const encodeWindows1252 = (str) => {
	return new Uint8Array(strToCodePoints(str));
};

const strToCodePoints = (str) => {
	return String(str)
		.split("")
		.map((c) => c.charCodeAt(0));
};

const encodeUtf16le = (str) => {
	const buffer = new ArrayBuffer(str.length * 2);
	const u8 = new Uint8Array(buffer);
	const u16 = new Uint16Array(buffer);

	u16.set(strToCodePoints(str));
	return u8;
};

const getNumericFrameSize = (frameSize) => {
	const headerSize = 10;
	const encodingSize = 1;

	return headerSize + encodingSize + frameSize;
};

const getStringFrameSize = (frameSize) => {
	const headerSize = 10;
	const encodingSize = 1;
	const bomSize = 2;
	const frameUtf16Size = frameSize * 2;

	return headerSize + encodingSize + bomSize + frameUtf16Size;
};

const getPictureFrameSize = (
	pictureSize,
	mimeTypeSize,
	descriptionSize,
	useUnicodeEncoding
) => {
	const headerSize = 10;
	const encodingSize = 1;
	const separatorSize = 1;
	const pictureTypeSize = 1;
	const bomSize = 2;
	const encodedDescriptionSize = useUnicodeEncoding
		? bomSize + (descriptionSize + separatorSize) * 2
		: descriptionSize + separatorSize;

	return (
		headerSize +
		encodingSize +
		mimeTypeSize +
		separatorSize +
		pictureTypeSize +
		encodedDescriptionSize +
		pictureSize
	);
};

const uint32ToUint8Array = (uint32) => {
	const eightBitMask = 0xff;

	return [
		(uint32 >>> 24) & eightBitMask,
		(uint32 >>> 16) & eightBitMask,
		(uint32 >>> 8) & eightBitMask,
		uint32 & eightBitMask,
	];
};

const uint28ToUint7Array = (uint28) => {
	const sevenBitMask = 0x7f;

	return [
		(uint28 >>> 21) & sevenBitMask,
		(uint28 >>> 14) & sevenBitMask,
		(uint28 >>> 7) & sevenBitMask,
		uint28 & sevenBitMask,
	];
};

const uint7ArrayToUint28 = (uint7Array) => {
	return (
		(uint7Array[0] << 21) +
		(uint7Array[1] << 14) +
		(uint7Array[2] << 7) +
		uint7Array[3]
	);
};
