// from youtube music build d0ea0c5b

export const decipherScript = (sig) => {
	const transformations = {
		swapElementAtPos: (array, position) => {
			const temp = array[0];
			array[0] = array[position % array.length];
			array[position % array.length] = temp;
		},
		reverseArray: (array) => {
			array.reverse();
		},
		spliceArray: (array, position) => {
			array.splice(0, position);
		},
	};
	const transform = (text) => {
		const a = text.split("");
		transformations.reverseArray(a, 67);
		transformations.spliceArray(a, 1);
		transformations.swapElementAtPos(a, 21);
		transformations.reverseArray(a, 57);
		transformations.swapElementAtPos(a, 13);
		transformations.swapElementAtPos(a, 18);
		transformations.reverseArray(a, 65);
		transformations.swapElementAtPos(a, 19);
		return a.join("");
	};
	return transform(sig);
};

export const nTransformScript = (ncode) => {
	return `enhanced_except_7ZoBkuX-_w8_${ncode}`;
};
