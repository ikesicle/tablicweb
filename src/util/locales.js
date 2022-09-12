import English from 'locales/english.json';
import AllUndef from 'locales/allundefined.json';
import Weeb from 'locales/weeb.json';

function fmt(str, cfg) {
	var trep = Object.getOwnPropertyNames(cfg);
	if (!str) return "undefined"
	trep.forEach(param => {
		str = str.replaceAll(`%${param}%`, cfg[param]);

	});

	return str;
}

const locales = {
	"English": English
}

var currentLocale = "English";
var text = locales[currentLocale];


function setLocale(str) {
	console.log(`Set Locale to ${str}`);
	currentLocale = str;
	text = locales[currentLocale]
}

export { fmt, locales, currentLocale, setLocale, text };