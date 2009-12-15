/**
 * OS judgement
 */
function getClientOS(){
	var isWin = (navigator.platform == "Win32") || (navigator.platform == "Windows");
	var isMac = (navigator.platform == "Mac68K") || (navigator.platform == "MacPPC") ||
	(navigator.platform == "Macintosh");
	
	var isUnix = (navigator.platform == "X11") && !isWin && !isMac;
	//先全部设为false  
	var isWin95 = isWin98 = isWinNT4 = isWin2K = isWinME = isWinXP = false;
	var isMac68K = isMacPPC = false;
	var isSunOS = isMinSunOS4 = isMinSunOS5 = isMinSunOS5_5 = false;
	
	if (isWin) {
		isWin95 = sUserAgent.indexOf("Win95") > -1 ||
		sUserAgent.indexOf("Windows 95") > -1;
		isWin98 = sUserAgent.indexOf("Win98") > -1 ||
		sUserAgent.indexOf("Windows 98") > -1;
		isWinME = sUserAgent.indexOf("Win 9x 4.90") > -1 ||
		sUserAgent.indexOf("Windows ME") > -1;
		isWin2K = sUserAgent.indexOf("Windows NT 5.0") > -1 ||
		sUserAgent.indexOf("Windows 2000") > -1;
		isWinXP = sUserAgent.indexOf("Windows NT 5.1") > -1 ||
		sUserAgent.indexOf("Windows XP") > -1;
		isWinNT4 = sUserAgent.indexOf("WinNT") > -1 ||
		sUserAgent.indexOf("Windows NT") > -1 ||
		sUserAgent.indexOf("WinNT4.0") > -1 ||
		sUserAgent.indexOf("Windows NT 4.0") > -1 &&
		(!isWinME && !isWin2K && !isWinXP);
	}
	if (isMac) {
		isMac68K = sUserAgent.indexOf("Mac_68000") > -1 ||
		sUserAgent.indexOf("68K") > -1;
		isMacPPC = sUserAgent.indexOf("Mac_PowerPC") > -1 ||
		sUserAgent.indexOf("PPC") > -1;
	}
	
	if (isUnix) {
		isSunOS = sUserAgent.indexOf("SunOS") > -1;
		
		if (isSunOS) {
			var reSunOS = new RegExp("SunOS (\\d+\\.\\d+(?:\\.\\d+)?)");
			reSunOS.test(sUserAgent);
			isMinSunOS4 = compareVersions(RegExp["$1"], "4.0") >= 0;
			isMinSunOS5 = compareVersions(RegExp["$1"], "5.0") >= 0;
			isMinSunOS5_5 = compareVersions(RegExp["$1"], "5.5") >= 0;
		}
	}
}

/**
 * Relative time
 */
function relative_time(time_value) {
	var parsed_date = new Date(Date.parse(time_value.replace(/-/g, "/")));   
	var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
	var delta = Math.floor((relative_to.getTime() - parsed_date.getTime()) / 1000);
	var subDate = Math.floor(delta / (60 * 60 * 24));
	if (delta < 60) return (delta?delta:1)  + "秒前";
	else if (delta < 60 * 60) return Math.floor(delta / 60) + "分钟前";
	else if (delta < 60 * 60 * 24) return Math.floor(delta / 60 / 60) + "小时前";
	else if (delta < 60 * 60 * 24 * 2 && subDate == 1) return "昨天";
	else if (delta < 60 * 60 * 24 * 3 && subDate == 2) return "前天";
	else if (delta < 60 * 60 * 24 * 30) return subDate + "天前";
	else if (delta < 60 * 60 * 24 * 365) return Math.floor(delta / (60 * 60 * 24 * 30)) + "月前";
	else if (delta < 60 * 60 * 24 * 365 * 2) return "去年";
	else if (delta < 60 * 60 * 24 * 365 * 3) return "前年";
	else return Math.floor(delta / 60 / 60 / 24 / 365) + "年前";	
}

//----------------------------------------------------------------------------

/**
 * Base64 encode / decode
 * http://www.webtoolkit.info/
 */
var Base64 = {
	// private property
	_keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
	// public method for encoding
	encode : function (input) {
		var output = "";
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0;
		input = Base64._utf8_encode(input);
		while (i < input.length) {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);
			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;
			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}
			output = output +
			this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
			this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
		}
		return output;
	},
	// public method for decoding
	decode : function (input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
		input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
		while (i < input.length) {
			enc1 = this._keyStr.indexOf(input.charAt(i++));
			enc2 = this._keyStr.indexOf(input.charAt(i++));
			enc3 = this._keyStr.indexOf(input.charAt(i++));
			enc4 = this._keyStr.indexOf(input.charAt(i++));
			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;
			output = output + String.fromCharCode(chr1);
			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}
		}
		output = Base64._utf8_decode(output);
		return output;
	},
	// private method for UTF-8 encoding
	_utf8_encode : function (string) {
		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
		for (var n = 0; n < string.length; n++) {
			var c = string.charCodeAt(n);
			if (c < 128) {
				utftext += String.fromCharCode(c);
			}
			else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			}
			else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
		}
		return utftext;
	},
	// private method for UTF-8 decoding
	_utf8_decode : function (utftext) {
		var string = "";
		var i = 0;
		var c = c1 = c2 = 0;
		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i);
			if (c < 128) {
				string += String.fromCharCode(c);
				i++;
			}
			else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			}
			else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return string;
	}
}

//----------------------------------------------------------------------------

if(!this.JSON){JSON={};}
(function(){function f(n){return n<10?'0'+n:n;}
if(typeof Date.prototype.toJSON!=='function'){Date.prototype.toJSON=function(key){return this.getUTCFullYear()+'-'+
f(this.getUTCMonth()+1)+'-'+
f(this.getUTCDate())+'T'+
f(this.getUTCHours())+':'+
f(this.getUTCMinutes())+':'+
f(this.getUTCSeconds())+'Z';};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf();};}
var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={'\b':'\\b','\t':'\\t','\n':'\\n','\f':'\\f','\r':'\\r','"':'\\"','\\':'\\\\'},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==='string'?c:'\\u'+('0000'+a.charCodeAt(0).toString(16)).slice(-4);})+'"':'"'+string+'"';}
function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==='object'&&typeof value.toJSON==='function'){value=value.toJSON(key);}
if(typeof rep==='function'){value=rep.call(holder,key,value);}
switch(typeof value){case'string':return quote(value);case'number':return isFinite(value)?String(value):'null';case'boolean':case'null':return String(value);case'object':if(!value){return'null';}
gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==='[object Array]'){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||'null';}
v=partial.length===0?'[]':gap?'[\n'+gap+
partial.join(',\n'+gap)+'\n'+
mind+']':'['+partial.join(',')+']';gap=mind;return v;}
if(rep&&typeof rep==='object'){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==='string'){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?': ':':')+v);}}}}
v=partial.length===0?'{}':gap?'{\n'+gap+partial.join(',\n'+gap)+'\n'+
mind+'}':'{'+partial.join(',')+'}';gap=mind;return v;}}
if(typeof JSON.stringify!=='function'){JSON.stringify=function(value,replacer,space){var i;gap='';indent='';if(typeof space==='number'){for(i=0;i<space;i+=1){indent+=' ';}}else if(typeof space==='string'){indent=space;}
rep=replacer;if(replacer&&typeof replacer!=='function'&&(typeof replacer!=='object'||typeof replacer.length!=='number')){throw new Error('JSON.stringify');}
return str('',{'':value});};}
if(typeof JSON.parse!=='function'){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==='object'){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v;}else{delete value[k];}}}}
return reviver.call(holder,key,value);}
cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return'\\u'+
('0000'+a.charCodeAt(0).toString(16)).slice(-4);});}
if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,'@').replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,']').replace(/(?:^|:|,)(?:\s*\[)+/g,''))){j=eval('('+text+')');return typeof reviver==='function'?walk({'':j},''):j;}
throw new SyntaxError('JSON.parse');};}})();

//----------------------------------------------------------------------------
