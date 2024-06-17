export const parseQueryString = (url) => {
	return (url.split("?")[1] || url)?.split("&").reduce((a, b) => {
		a[b.split("=")[0]] = b.split("=")[1];
		return a;
	}, {});
};
