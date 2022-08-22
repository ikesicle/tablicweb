import English from './locales/english.json';
import AllUndef from './locales/allundefined.json';
import Weeb from './locales/weeb.json';

export function fmt(str, cfg) {
	var trep = Object.getOwnPropertyNames(cfg);
	if (!str) return "undefined"
	trep.forEach(param => {
		str = str.replaceAll(`%${param}%`, cfg[param]);

	});

	return str;
}

export const locales = {
	"English": English
}

export var currentLocale = "English";
export let text = locales[currentLocale];


export function setLocale(str) {
	console.log(`Set Locale to ${str}`);
	currentLocale = str;
	text = locales[currentLocale]
}