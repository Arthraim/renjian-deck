﻿/**
 * renjian-deck
 * Oct 27 2009
 * Arthur Wang
 */

var ada = function () {

    var REFRESH_MS = 120000,
        MAX_STATUSES = 100,
        PREFS_FILE = "prefs.json",
        SRCH_URL = "http://renjian.com/q/",
        ROOT_URL = "http://renjian.com/",
        TWTR_URL = "http://api.renjian.com/",
        HOME_URL = TWTR_URL + "statuses/friends_timeline.json",
        REPL_URL = TWTR_URL + "statuses/mentions.json",
        PBLC_URL = TWTR_URL + "statuses/public_timeline.json",
        UPDT_URL = TWTR_URL + "statuses/update.json",
        CFAV_URL = TWTR_URL + "favorites/create/",
        DFAV_URL = TWTR_URL + "favorites/destroy/",
        FAVL_URL = TWTR_URL + "favorites/list.json",
        MSGS_URL = TWTR_URL + "direct_messages/receive.json",
        DMSG_URL = TWTR_URL + "direct_messages/new.json",
        USER_URL = TWTR_URL + "users/show/",
		VRFY_URL = TWTR_URL + "account/verify_credentials.json",
        
        gReplRegex = /^@\w+\s/,      // match replies in update input
        gDmsgRegex = /^d\s(\w+)\s/,  // match dm's in update input
        gTailRegex = /[.,!?)]*$/ig,  // match .,!?) after url for inline links
        
        gMsg = null,
        gNotify = null,
        gPicbox = null,
		
		gClientAppId = '4c1f052a7dd8759cc1a71c49',
        
        gUser = "", 
        gPass = "",
        gAuthorized = false,
        gRememberMe = false,
        gSocketOpen = false,
        gServerTime = null,
        
        gAppName = "", gAppVersion = "",
        
        imgCache = {},

        gLoaders = {}, // home, repl, pblc, msgs, updt, dmsg, cfav, dfav, favl, push, user, vrfy
        gStatuses = {},
        gCvstWindows = new Array(),
		gUserWindows = new Array(),
        
        gTimer = null,
        gLoader = "home", // home, repl, msgs
        gShowInput = false,
        gInReplyToStatusId = null,
        gDmUserId = null,
        
        gStatusType = "TEXT",
        gOriginalUrl = null,
        gLinkTitle = null,
        gLinkDesc = null,
        
        gPrefsTimer = null,
        gPrefs = {
            showAvatars: true,
            alwaysShowUpdate: false,
            onTop: false,
            themeName: "rensea",
            startAtLogin: true
        };

    //-----------------------------------------------------------------------
    
    function myTrace(str) {
        // comment out the following line for distribution builds
        air.trace(str);
    }

    //-----------------------------------------------------------------------

    function getPrefs() { //get首选项
        var file, fStream, prefs;
        file = air.File.applicationStorageDirectory.resolvePath(PREFS_FILE);
        fStream = new air.FileStream();
        try {
            fStream.open(file, air.FileMode.READ);
            prefs = JSON.parse(fStream.readUTFBytes(fStream.bytesAvailable));
            fStream.close();
        } catch (error) {
            myTrace(error);
        }
        $.extend(gPrefs, prefs);
        
        // hack to get rid of a preference that is no longer used.
        // can eventually remove this.
        if (gPrefs.defaultTheme) {
            delete(gPrefs.defaultTheme);
        }
    }
    
    function setPrefs() { //set首选项
        var file, fStream;
        file = air.File.applicationStorageDirectory.resolvePath(PREFS_FILE); 
        fStream = new air.FileStream(); 
        fStream.open(file, air.FileMode.WRITE); 
        fStream.writeUTFBytes(JSON.stringify(gPrefs)); 
        fStream.close();
    }
    
    function saveAuth() { //保存登录
        if (gRememberMe && !gAuthorized) {
            gAuthorized = true;
            gPrefs.user = gUser;
            gPrefs.pass = gPass;
            setPrefs();
        }
    }

    function saveBounds() { //保存边界设置
        myTrace('saveBounds');
        gPrefs.bounds = [
            window.nativeWindow.bounds.x, 
            window.nativeWindow.bounds.y,
            window.nativeWindow.bounds.width, 
            window.nativeWindow.bounds.height
        ];
        setPrefs();
    }

    //-----------------------------------------------------------------------

    function msg() {
        var timer, speed = 150;
        function say(msg, dur) {
            var duration = dur || 5000;
            if (timer) {
                window.clearTimeout(timer);
                timer = null;
            }
            $("#dvmessage").text(msg).show();
            timer = window.setTimeout(function () {
                $("#dvmessage").fadeOut(speed);
            }, duration);
        }
        return {say: say};
    }

    //-----------------------------------------------------------------------

    function status(baseURL) {
        var since_id = 10000,
            statuses = [];
            
        function getStatuses() {
            return statuses;
        }

        function reset() {
            since_id = 10000;
            statuses = [];
        }

        function updateStatuses(newStatuses) {
            myTrace("updateStatuses " + newStatuses.length);
            statuses = newStatuses.concat(statuses);
            statuses.splice(MAX_STATUSES);
            if (statuses.length > 0) {
                since_id = statuses[0].id;
            }
        }
        
        function getURL() {
            var url = baseURL + "?" + //client_app_id=" + gClientAppId + 
			    "count=" + MAX_STATUSES + 
                "&since_id=" + since_id;
            return  url;
        }
        
        function modFav(id, favorited) {
            myTrace("modFav " + id + ", " + favorited);
            var i;
            for (i = 0; i < statuses.length; i++) {
                if (statuses[i].id === id) {
                    statuses[i].favorited = favorited;
                    break;
                }
            }
        }

        return {
            getStatuses: getStatuses,
            reset: reset,
            updateStatuses: updateStatuses,
            getURL: getURL,
            modFav: modFav
        }
    }

    //-----------------------------------------------------------------------

    function loader(onSuccess) {
        var ldr, status = 0;

        function onStatus(event) { 
            status = event.status;
        }

        function onError(event) { 
            myTrace("IOERROR: " + event.text);
            $("#dvthrobber").hide();
        }

        function onComplete(event) {
            var data;
            $("#dvthrobber").hide();
            if (status == 200) {
                setTitle(gAppName + " : " + gUser);
                saveAuth();
                onSuccess(event.target.data);
            } else if (status == 400 || status == 403) {
                data = JSON.parse(event.target.data);
                if (data && data.error) {
                    gMsg.say("人间网返回错误: " + data.error);
                }
            } else if (status == 401) {
                showLogin(true);
            } else if (status == 404) {
                gMsg.say("人间网返回 404 Not Found error.");
            } else if (status == 500) {
                gMsg.say("人间网返回 500 Internal Server error.");
            } else if (status == 502) {
                gMsg.say("人间网正在维护中，请关注人间网官方信息。(502)");
            } else if (status == 503) {
                gMsg.say("人间网过载，请稍候重试。(503)");
            } else {
                myTrace("httpStatus = " + status);
                myTrace(event.target.data);
            }
        }
        
        function load(req) {
            $("#dvthrobber").show();
            ldr.load(req);
        }

        ldr = new air.URLLoader();
        ldr.addEventListener(air.IOErrorEvent.IO_ERROR, onError);
        ldr.addEventListener(air.Event.COMPLETE, onComplete);
        ldr.addEventListener(air.HTTPStatusEvent.HTTP_RESPONSE_STATUS, 
            onStatus);

        return {
            load: load
        };  
    }

    //-----------------------------------------------------------------------

    function getRequest(url, isPost, data, isHead) {
        var req = new air.URLRequest(url);
        req.requestHeaders.push(new air.URLRequestHeader("Authorization", 
            "Basic " + Base64.encode(gUser + ":" + gPass)));
        req.authenticate = false;
        req.manageCookies = false;
        req.method = 
            isPost ? air.URLRequestMethod.POST : air.URLRequestMethod.GET;
		req.method =
		    isHead ? air.URLRequestMethod.HEAD : req.method;
        req.data = data;
        return req;
    }

    //-----------------------------------------------------------------------

    function clearTimer() {
        if (gTimer) {
            window.clearTimeout(gTimer);
            gTimer = null;
        }
    }

    //-----------------------------------------------------------------------

    function doIt() {
        var req = getRequest(gStatuses[gLoader].getURL());

        clearTimer();
        try {
			myTrace("Loading " + gStatuses[gLoader].getURL())
            gLoaders[gLoader].load(req);
        } catch(error) {
            myTrace("Unable to load url " + error);
            myTrace(req.url);
        }
        gTimer = window.setTimeout(doIt, REFRESH_MS);
    }

    //-----------------------------------------------------------------------

    function onMove(event) {
        window.nativeWindow.startMove();
    }

    function onResize(event) {
        window.nativeWindow.startResize(air.NativeWindowResize.BOTTOM_RIGHT);
    }

    function onMinimize() {
        window.nativeWindow.minimize();
    }
    
    function onTrayIconize() {
        window.nativeWindow.visible = false;
    }
    
    function onMoveResize(event) {
        if (gPrefsTimer) {
            window.clearTimeout(gPrefsTimer);
        }
        gPrefsTimer = window.setTimeout(function () {   
            saveBounds();
        }, 4000);
    }
            
    function onExit(event) {
        pusher.close();
        gSocketOpen = false; // doesn't matter
        saveBounds();
        air.NativeApplication.nativeApplication.icon.bitmaps = []; 
        air.NativeApplication.nativeApplication.exit();
    }

    function onLinkClick(event) {
        myTrace("onLinkClick. navigateToURL: " + event.currentTarget);
        //event.preventDefault(); 
        //event.stopPropagation(); 
        air.navigateToURL(new air.URLRequest(event.currentTarget));
        return false;
    }
    
    function setTitle(title) {
        document.title = title;
        $("#dvtitlebar").text(title);
    }

    //-----------------------------------------------------------------------

    function showMain() {
        //$("#dvabout").hide();
        $("#dvlogin").hide();
        $("#dvmain").show();
        if (gPrefs.alwaysShowUpdate == true) {
            gShowInput = true;
            showUpdateArea(gShowInput);
        }
    }

    function showAbout() {
        //clearTimer();
        //$("#dvmain").hide();
        $("#dvlogin").hide();
        $("#dvabout").slideDown();
        //$("#dvabout").width(window.nativeWindow.bounds.width - 38);
    }

    function showLogin(err) {    
        gUser = "";
        gPass = "";
        
        gShowInput = false;
        gLoader = "home";
        gInReplyToStatusId = null;
        
        gStatuses["home"].reset();
        gStatuses["repl"].reset();
        gStatuses["pblc"].reset();
        gStatuses["favl"].reset();
        gStatuses["msgs"].reset();
        
        $("#dvupdateinput").val("");
        $("#inusernm,#inpasswd").val("");
        $("#inurl,#infilter,#urltitle").val("").blur();
        $("#spq").text(function () {
            var q = [
                "饭否？人间有饭吃！",
                "来人间嘀咕几句吧～",
                "人间一下，你就知道！",
                "兄弟，做啥呢？",
                "来人间叽歪？",
                "别着急，像个火兔似的～",
                "人间教你句粤语：雷猴～",
                "天气变化快，准备好围脖",
                "想朋友了？快去冒泡～",
                "鸟怎么叫？twitter~ twitter~",
                "网聚人间力量"
            ];
            return q[Math.floor(Math.random() * q.length + 1) - 1];
        }());

        clearTimer();
        onUpdateChange();
        showUpdateArea(gShowInput);
        setTitle(gAppName);
        
        if (err) {
            gMsg.say("连接失败了Orz，再试一次～", 2000);
        }
           
        $("#dvabout").slideUp();    
        $("#dvmain").hide();    
        $("#dvlogin").show();
        $("#inusernm").focus();
    }

    //-----------------------------------------------------------------------

    function onSignout(event) {
        pusher.close();
        gSocketOpen = false;
        gAuthorized = false;
        gRememberMe = false;
        gPrefs.user = gPrefs.pass = "";
        setPrefs();
        showLogin(false);
    }

    function onSignin() {
        gUser = $.trim($("#inusernm").val());
        gPass = $.trim($("#inpasswd").val());
        if (!gUser || !gPass) {
            showLogin(true);
            return;
        }
        gRememberMe = $("#chkrememberme").val();
        doIt();
    }

    //-----------------------------------------------------------------------

    function onAvatars(event) {
        myTrace("onAvatars");
        gPrefs.showAvatars = !gPrefs.showAvatars;
        if (gPrefs.showAvatars) {
            $("#miavatars").text("隐藏头像");
        } else {
            $("#miavatars").text("显示头像");
        }
        setPrefs();
        drawStatuses();
    }
    
    function onAlwaysShow(event) {
        gPrefs.alwaysShowUpdate = !gPrefs.alwaysShowUpdate;
        if (gPrefs.alwaysShowUpdate) {
            $("#miinput").text("隐藏输入");
        } else {
            $("#miinput").text("显示输入");
            showUpdateArea(false);
        }
        showMain();
    }
    
    function onStartAtLogin(event) {
    	gPrefs.startAtLogin = !gPrefs.startAtLogin;
        if (gPrefs.startAtLogin) {
            $("#miautostart").text("关闭自动启动");
            air.NativeApplication.nativeApplication.startAtLogin = true;
        } else {
            $("#miautostart").text("打开自动启动");
            air.NativeApplication.nativeApplication.startAtLogin = false;
        }
    }
    
    //-----------------------------------------------------------------------

    function loadTheme(theme) {
        theme = theme || "rensea";
        $("#ss")[0].href = "../themes/" + theme + "/styles.css";
        loadAllWindowsTheme(theme);
    }
    
    function loadAllWindowsTheme(theme) {
        for (var i in gCvstWindows) {
            if (gCvstWindows[i] == null) 
                continue;
            else if (gCvstWindows[i].stage.nativeWindow.closed == true) 
                gCvstWindows[i] = null;
            else {
                gCvstWindows[i].window.chat.loadTheme(theme);
            }
        }
		for (var i in gUserWindows) {
            if (gUserWindows[i] == null) 
                continue;
            else if (gUserWindows[i].stage.nativeWindow.closed == true) 
                gUserWindows[i] = null;
            else {
                gUserWindows[i].window.user.loadTheme(theme);
            }
        }
    }

    function onThemeChange(event) {
        var theme = $(event.target).text();
        myTrace(theme);
        loadTheme(theme);
        gPrefs.themeName = theme;
        setPrefs();
        onTheme();  
    }

    function onTheme(event) {
        var themeDirs, i;
        themeDirs = air.File.applicationDirectory
            .resolvePath("themes")
            .getDirectoryListing();
        $("#dvthemelist").empty();
        for (i = 0; i < themeDirs.length; i++) {
            $("#dvthemelist").append(
                $("<div></div>")
                    .addClass("menuitem")
                    .text(themeDirs[i].name)
                    .css("font-weight", 
                         (themeDirs[i].name == gPrefs.themeName) ?
                         "bold" : "normal")
                    .click(onThemeChange));
        }
        $("#dvthememenu").slideDown("fast");        
    }
    
    //-----------------------------------------------------------------------

    function onUpdateChange(event) {
        var len = 140 - $("#dvupdateinput").val().length,
            dmsgMatch;
//        $("#dvupdatecount").text(len);
        if (gReplRegex.test($("#dvupdateinput").val())) {
            $("#bnupdatesend").text("回应");
        } else {
            gInReplyToStatusId = null;
            dmsgMatch = $("#dvupdateinput").val().match(gDmsgRegex);
            if (dmsgMatch) {
                $("#bnupdatesend").text("悄悄话");
//                $("#dvupdatecount").text(len + dmsgMatch[0].length);
            } else {
                $("#bnupdatesend").text("发送");
            }
        }
    }

    //-----------------------------------------------------------------------

    function showUpdateArea(show) {
        var h, speed = 200;
        if (show) {
            h = $("#dvupdatearea").outerHeight();
            $("#dvtimeline,#dvbottomborder").animate({
                bottom: (h + 26) + "px"
            }, speed, null);
            $("#dvupdatearea").slideDown(speed, function () {
                $("#dvupdateinput").focus();
                $("#dvupdateinput")[0].setSelectionRange(1000, 1000);
            });
            $("#infilter").fadeOut(speed); 
            /*, function () {
                $("#inurl,#dvurl").fadeIn(speed);                
            });*/
        } else {
            // revert
            gStatusType = "TEXT";
            gOriginalUrl = null;
            gLinkTitle = null;
            gLinkDesc = null;
            
            $("#dvupdatearea").slideUp(speed);
            $("#dvtimeline,#dvbottomborder").animate({
                bottom: "26px"
            }, speed);
            $("#inurl,#dvurl,#urltitle,#dvurlcncl").fadeOut(speed, function () {
                $("#infilter").fadeIn(speed);    
            });
        }
    }

    function onToggleInputArea(event) {
        setShowInput(!gShowInput);
        showUpdateArea(gShowInput);
    }
    
    function setShowInput(showInput){
        if (gPrefs.alwaysShowUpdate == false) {
            gShowInput = showInput;
        }
    }
    
    //-----------------------------------------------------------------------

    function parseParentNodeData(event) {
        // structure of id attribute of .dvtweet is...
        //   id:;user:;fav:;txt
        //   :; was chosen as the delimiter because hopefully(!?) it's unique
        // the buttons are inside .btncontainer which is inside .dvtweet,
        //   hence parentNode.parentNode...
        if(event.target.id)
            return event.target.id.split(":;");
        else if(event.target.parentNode.id)
            return event.target.parentNode.id.split(":;");
        else if(event.target.parentNode.parentNode.id)
            return event.target.parentNode.parentNode.id.split(":;");
        else if(event.target.parentNode.parentNode.parentNode.id)
            return event.target.parentNode.parentNode.parentNode.id.split(":;");
        else if(event.target.parentNode.parentNode.parentNode.parentNode.id)
            return event.target.parentNode.parentNode.parentNode.parentNode.id.split(":;");
        else if(event.target.parentNode.parentNode.parentNode.parentNode.parentNode.id)
            return event.target.parentNode.parentNode.parentNode.parentNode.parentNode.id.split(":;");
        else return null;
    }

    function onFav(event) {
        event.stopPropagation();
        var id_fav, url, vars, fav;
        id_fav = parseParentNodeData(event);
        myTrace("onFav " + id_fav[0] + ", " + id_fav[2]);
        if (id_fav[2] == "true") {
            url = DFAV_URL + id_fav[0] + ".json";
            fav = "dfav";
        } else {
            url = CFAV_URL + id_fav[0]+ ".json";
            fav = "cfav";
        }
        vars = new air.URLVariables();
        vars["id"] = id_fav[0];        
        try {
            gLoaders[fav].load(getRequest(url, true, vars));
        } catch(error) {
            myTrace('Unable to load URL: ' + error);
        }
    }

    function onReply(event) {
        event.stopPropagation();
        var id_user = parseParentNodeData(event);
        gInReplyToStatusId = id_user[0];
        $("#dvupdateinput").val("@" + id_user[1] + " ");
        onUpdateChange();
        setShowInput(true);
        showUpdateArea(gShowInput);
    }

    function onRt(event) {
        event.stopPropagation();
        var id_user_txt = parseParentNodeData(event),
            rt = "RT @" + id_user_txt[1] + " " + id_user_txt[3];
        $("#dvupdateinput").val(rt);
        onUpdateChange();
        setShowInput(true);
        showUpdateArea(gShowInput);
    }

    function onDM(event) {
        event.stopPropagation();
        var id_user = parseParentNodeData(event);
        $("#dvupdateinput").val("d " + id_user[1] + " ");
//        gDmUser = id_user[i];
        onUpdateChange();
        setShowInput(true);
        showUpdateArea(gShowInput);
    }

    //-----------------------------------------------------------------------

    function onLoadSuccess(data) {
        // 这段代码应该要继续封装
        if(gSocketOpen == false) {
			initVrfy();
            initPusher();
            //pusher.begin();
            //gSocketOpen = true;
        }/* else if(gAuthorized == false && gSocketOpen == true) {
            pusher.close();
            gSocketOpen = false;
        }*/
        // 到这里为止
        
        gStatuses[gLoader].updateStatuses(JSON.parse(data));
        drawStatuses();
    }

    function onUpdtSuccess(data) {
        $("#dvupdateinput").val("");
        onUpdateChange();
        setShowInput(false);
        showUpdateArea(gShowInput);
        // revert
        gStatusType = "TEXT";
        gOriginalUrl = null;
        gLinkTitle = null;
        gLinkDesc = null;
        
        doIt();    
    }

    function onCFavSuccess(data) {
        var d = JSON.parse(data);
        gStatuses[gLoader].modFav(d.id, true);
        gMsg.say("顶！要扣2个金币哟～", 2000);
        drawStatuses();
    }

    function onDFavSuccess(data) {
        var d = JSON.parse(data);
        gStatuses[gLoader].modFav(d.id, false);
        gMsg.say("取消顶，不过金币是回不来滴～", 2000);
        drawStatuses();
    }

    //-----------------------------------------------------------------------

    function onUpdate() {
        myTrace("onUpdate");
        var vars,
            url = UPDT_URL,
            loader = "updt",
            recipient,
            txt = $.trim($("#dvupdateinput").val());
        if (txt === "") {
            gMsg.say("不要发送空白消息哦～");
            return;
        }
        vars = new air.URLVariables();
        vars["source"] = "人间浮云"; //gAppName;
        recipient = txt.match(gDmsgRegex);
        if (recipient) {
            url = DMSG_URL;
            loader = "dmsg";
            vars["status_type"] = "TEXT";
            vars["link_type"] = "TEXT";
            vars["user"] = recipient[1];
            vars["text"] = txt.substring(recipient[0].length);
        } else {
            if (gStatusType == "TEXT") {
                vars["text"] = txt;
                vars["status_type"] = "TEXT";
                vars["link_type"] = "TEXT";
                if (gInReplyToStatusId) {
                    vars["in_reply_to_status_id"] = gInReplyToStatusId;
                }
            } else if (gStatusType == "LINK") {
                if(gOriginalUrl == null){
                    gMsg.say("hi,在输入要分享的链接或取消添加链接后再发送吧~");
                    return;
                }
                vars["text"] = txt;
                vars["status_type"] = "LINK";
                vars["link_type"] = "LINK";
                vars["original_url"] = gOriginalUrl;
                vars["link_title"] = $("#urltitle").val();
                vars["link_desc"] = gLinkDesc;
                if (gInReplyToStatusId) {
                    vars["in_reply_to_status_id"] = gInReplyToStatusId;
                }
            }
        }
        try {
            gLoaders[loader].load(getRequest(url, true, vars));
        } catch(error) {
            myTrace('Unable to load URL: ' + error);
        }
    }

    //-----------------------------------------------------------------------

    function drawStatuses() {
        var dvtweet, i, tweets = gStatuses[gLoader].getStatuses();

        myTrace("drawStatuses: " + gLoader + " " + tweets.length);

        $("#dvtimeline").empty();

        if (tweets.length == 0) {
            $("#dvtimeline")
                .append($("<div></div>")
                    .css("padding", "10px")
                    .html("啥也没有的说～"));
            return;
        }

        for (i = 0; i < tweets.length; i++) {
            dvtweet = generateHtml(tweets[i]);
            $("#dvtimeline").append(dvtweet);
        }
        $(".link").click(onLinkClick);
        $(".pic").click(onPicClick);
        $(".tweetpic").toggle(gPrefs.showAvatars);
        doFilter();
        showMain();
    }
    
    function generateHtml(tweet) {
        var dvtweet, id, user, name, gender, img, when, favorited, txt, i, tailMatch,
            dvbtncontainer, rawtxt, relative_when, thumbnail, root_status_id,
            status_type, link_url, original_url, link_title, link_desc, favoriters,
            in_reply_to_screen_name;
            
        id = tweet.id;
        when = tweet.created_at;
        favorited = tweet.favorited;
        rawtxt = $.trim(tweet.text);
        status_type = tweet.status_type || "TEXT";
        link_url = tweet.link_url || null;
        link_title = tweet.link_title || null;
        link_desc = tweet.link_desc || null;
        original_url = tweet.original_url || null;
        thumbnail = tweet.thumbnail || null;
        root_status_id = tweet.root_status_id  || id;
        favoriters = tweet.favoriters || null;
        in_reply_to_screen_name = tweet.in_reply_to_screen_name || null;
        
        if (gServerTime)
            relative_when = relative_time(when, gServerTime); //tweet.relative_date;
        else
            relative_when = relative_time(when); //tweet.relative_date;

        if (gLoader == "msgs") {
            user = tweet.sender.screen_name;
            name = tweet.sender.name;
            img = tweet.sender.profile_image_url;
            gender = tweet.sender.gender;
        } else {
            user = tweet.user.screen_name;
            name = tweet.user.name;
            img = tweet.user.profile_image_url;
            gender = tweet.user.gender;
        }
        
        if(user == name){
            name = null;
        }
        
        // This only partially addresses the profile picture 
        // caching problem. 
        // - It works for the situation where a user has changed his 
        // profile pic and then posts an update. The update will point
        // to the new pic. The new pic will go into this cache and 
        // older tweets from this user will use the new pic from the cache
        // rather than the old pic that those old tweets point to.
        // - It doesn't address the situation where a user changes his
        // profile pic but doesn't make a new update. We will only pull
        // old tweets from this user and those old tweets still point
        // to the old profile pic which is an expired (broken) url.
        if (imgCache[user]) {
            img = imgCache[user];
        } else {
            imgCache[user] = img;
        }

        txt = rawtxt
            .replace(/\b(https?:\/\/[^\s+\"\<\>]+)/ig, function (url) {
                // We matched a url. If there is punctuation at the
                // end of the url, we need to remove it.
                tailMatch = url.match(gTailRegex);
                if (tailMatch[0]) {
                    url = url.slice(0, -tailMatch[0].length);
                }
                return "<a href='" + url + "' class='link'>" + url + 
                       "</a>" + tailMatch[0];
            })
            .replace(/@([\w\u4e00-\u9fa5]+)/g,
                "@<a href='" + ROOT_URL + "$1' class='user_link'>$1</a>")
            .replace(/#([\w\u4e00-\u9fa5]+)/g,
                "<a href='" + SRCH_URL + "$1' class='link'>#$1</a>");
            
        var linkHtml = "", picHtml = "", link_txt = "未知链接";
        if(link_title != null) link_txt = link_title; 
        else if(link_desc != null) link_txt = link_desc;
        else link_txt = original_url;
        
        if (status_type == "LINK") {
            linkHtml = "<a href='" + ROOT_URL + "a/status/redirect?statusId=" + id + 
                "&url=" + original_url + "' class='link'>" + 
                link_txt + "</a><br />";
            picHtml = thumbnail?"<img src='" + thumbnail + "' width='60'/><br />" : "";
        }
        else if (status_type == "PICTURE") {
            picHtml = "<a href='" + original_url + "' class='pic'>" +
            "<img src='" + thumbnail + "' width='60'/></a><br />";
        }
        
        var favoritersHtml = "";
        if(favoriters.length > 0) {
            favoritersHtml += 
                "<img src='../themes/" + gPrefs.themeName + "/images/favoriters.gif' />";
            for(i in favoriters){
                favoritersHtml += 
                    ("<a class='user_link' href='" + ROOT_URL + favoriters[i] + "'>" + favoriters[i] + "</a>");
                if(i == 2){
                    favoritersHtml += ("<a href='javascript:void();'>等</a>");
                    break;
                }
            }
        }
        
        var mentionmeHtml = "";
        if(in_reply_to_screen_name == null) {
            mentionmeHtml = "";
        } else if(in_reply_to_screen_name.toLowerCase() == gUser.toLowerCase()) {
            mmurl = "../themes/" + gPrefs.themeName + "/images/metionme.gif";
            mentionmeHtml = "<img src='" + mmurl + "' align='left' />";
        } else {
            mentionmeHtml = "";
        }
        
        dvtweet = $("<div></div>")
            .addClass("dvtweet")
            .attr("id", id + ":;" + user + ":;" + favorited + ":;" + rawtxt + ":;" + root_status_id)
            .html("<div class='tweetpic fl'>" +
                  "<img width='30' src='" + img.replace("120x120", "32x32") + "' /></div>" +
                  "<div class='onavators marginleft'><div class='t_status fl'>" +
                  "<div class='s_north'>" +
                  "  <div class='sn_user fl'><a href='" + ROOT_URL + user + "' " +
                  "    class='user_link screenname gender" + gender + "'>" + user +
                  (name?" (" + name + ")":"") + "</a></div>" +
				  "  <div class='sn_date fr'>" + relative_when + "</div>" + "</div>" +
                  "<div class='s_south'>" +
                  "  <div class='thumb fl'>" + picHtml + "</div>" + mentionmeHtml +
                  "  <div>" + txt + "</div>" + 
                  "  <div>" + linkHtml + "</div>" +
                  "  <div class='fvrters'>" + favoritersHtml + "</div>" + "</div></div>" +
                  "<div class='clear'></div>" + "</div>"
                  );

        dvbtncontainer = $("<div></div>").addClass("btncontainer");
        dvtweet.append(dvbtncontainer);

        if (gLoader == "msgs") {
            dvbtncontainer
                .append($("<div>悄悄话</div>")
                .addClass("btndm")
                .click(onDM));
            dvtweet
                .hover(function () {
                    $(".btndm", $(this)).show();
                }, function () {
                    $(".btndm", $(this)).hide();
                });
        } else {
            dvbtncontainer
                .append($("<div></div>")
                    .addClass(favorited ? "btnunfav" : "btnfav")
                    .click(onFav));
            if (gUser != user) {
                dvbtncontainer
                    .append($("<div></div>")
                        .addClass("btnreply")
                        .click(onReply))
                    /* rensea needs not rt
                    .append($("<div>收藏</div>")
                        .addClass("btnrt")
                        .click(onRt));
                    */
            }
            dvtweet
                .hover(function () {
                    $(".btnfav,.btnreply,.btnrt", $(this)).show();
                }, function () {
                    $(".btnfav,.btnreply,.btnrt", $(this)).hide();
                });
        }
        
        return dvtweet;
    }

    /* removed for version 1.20
    function html_entity_decode(str) {
        return str;
        return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }
    */
        
    //-----------------------------------------------------------------------

    function doFilter() {
        var regex, p = $.trim($("#infilter").val());
        if (p === $("#infilter")[0].title) {
            p = "";
        }    
        regex = new RegExp("^" + p, "i");
        $(".dvtweet").each(function () {
            var id_user = this.id.split(":;");
            if (regex.test(id_user[1])) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
    }

    //-----------------------------------------------------------------------

    function setUpMainMenu() {
        var menuTimer = null, menuShowing = false;

        function showMenu() {
            if (menuTimer) {
                window.clearTimeout(menuTimer);
                menuTimer = null;
            }
            if (menuShowing) {
                return;
            }
            $("#mihome,#mirepl,#mipblc,#favl,#mimsgs").css("font-weight", "normal");
            $("#mi" + gLoader).css("font-weight", "bold");
            menuTimer = window.setTimeout(function () {
                $("#dvmainmenu").slideDown("fast", function () {
                    menuShowing = true;
                    menuTimer = null;
                });
            }, 200);        
        }
        
        function hideMenu(force) {
            if (force) {
                $("#dvmainmenu").slideUp("fast", function () {
                    menuShowing = false;
                    menuTimer = null;
                });
            }
            if (menuTimer) {
                window.clearTimeout(menuTimer);
                menuTimer = null;
            }
            menuTimer = window.setTimeout(function () {
                $("#dvmainmenu").slideUp("fast", function () {
                    menuShowing = false;
                    menuTimer = null;
                });
            }, 400);        
        }
    
        // menu slide in/out
        $("#dvmenu").hover(showMenu);
        $("#dvmenucontainer").hover(showMenu, function () {
        	$("#dvprefmenu").hide();
            hideMenu();
        });
        $("dvmainmenu .menuitem").click(function () {
            hideMenu(true);
        });

        $("#mihome").click(function () {
            gLoader = "home";
            doIt(); 
        });
        $("#mirepl").click(function () { 
            gLoader = "repl";
            doIt(); 
        });
        $("#mipblc").click(function () { 
            gLoader = "pblc";
            doIt(); 
        });
        $("#mifavl").click(function () { 
            gLoader = "favl";
            doIt(); 
        });
        $("#mimsgs").click(function () { 
            gLoader = "msgs";
            doIt(); 
        });
        $("#mirefresh").click(function () {
            gStatuses[gLoader].reset();
            doIt();
        });
        $("#miavatars").click(onAvatars);
        $("#mitheme").click(onTheme);
        $("#mipref").hover(function(){
			$("#dvprefmenu").show();
		});
        $("#miabout").click(showAbout);    
        $("#misignout").click(onSignout);
        $("#miexit").click(onExit);
        $("#miontop").click(onOntop);
        $("#miinput").click(onAlwaysShow);
        $("#miautostart").click(onStartAtLogin);
		$("#mideveloper").click(function(){
			newUserWindow("Arthraim");
		});
    }

    //-----------------------------------------------------------------------
    
    function shareLink() {
        var speed = 200, url, ldr, req, status = 0;

        function onStatus(event) { 
            status = event.status;
        }

        function onError(event) { 
            myTrace("share link ERROR: " + event.text);
            $("#dvthrobber").hide();
        }

        function onComplete(event) {
            $("#dvthrobber").hide();
            if (status == 200) {
                gOriginalUrl = url;
                gLinkDesc = url;
                var titleReg = /<title[^>]*>[^<>]*?<\/title>/gi,
                    tagReg= /<[^>]*>|\\n/g;
                try{
                    var title = titleReg.exec(event.target.data)[0];
                    title = title.replace(tagReg, "");
                } catch (ex) {
                    myTrace(ex);
                    title = url;
                }
                gLinkTitle = title;
                $("#urltitle").val(title);
                $("#inurl").val("").blur();
                $("#inurl, #dvurl").fadeOut(speed, function () {
                    $("#urltitle, #dvurlcncl").fadeIn(speed);
                });
            } else if (status == 500) {
                gMsg.say(event.target.data.toString());
            } else {
                gMsg.say("链接分享失败，过会儿试试看～");
                myTrace("httpStatus = " + status);
                myTrace(event.target.data);
            }
        }
        
        url = $.trim($("#inurl").val());
        if (!url || url === $("#inurl")[0].title) {
            gMsg.say("空的？把你要分享的链接贴过来吧～");
            return;
        } else {
            if (url.substr(0, 7) != "http://") {
                url = "http://" + url;
            }
        }
        
        ldr = new air.URLLoader();
        ldr.addEventListener(air.IOErrorEvent.IO_ERROR, onError);
        ldr.addEventListener(air.Event.COMPLETE, onComplete);
        ldr.addEventListener(air.HTTPStatusEvent.HTTP_RESPONSE_STATUS, 
            onStatus);

        req = new air.URLRequest(url);

        try {
            $("#dvthrobber").show();
            ldr.load(req);
        } catch(error) {
            myTrace("Unable to load url " + error);
            myTrace(req.url);
        }
    }
    
    //-----------------------------------------------------------------------
    
    function initPusher() {
        var screenName = gUser;
        try {
            url = USER_URL + screenName + ".json";
            gLoaders["push"].load(getRequest(url, false));
        } catch(error) {
            myTrace('Unable to load URL: ' + error);
        }
    }
    
    function onPushSuccess(data) {
        var u = JSON.parse(data);
        var uid = u.id.toString();
        myTrace(uid);
        pusher.setUser(uid);
        pusher.begin();
        gSocketOpen = true;
    }
    
    //----------------------------------------------------------------------
    
    function getUser(screenName) {
        try {
            url = USER_URL + screenName + ".json";
            gLoaders["user"].load(getRequest(url, false));
        } catch(error) {
            myTrace('Unable to load URL: ' + error);
        }
    }
    
    function onUserSuccess(data) {
        myTrace("onUserSuccess!");
        var u = JSON.parse(data);
        pusher.setUser(uid);
        pusher.begin();
        gSocketOpen = true;
    }
	
    //----------------------------------------------------------------------	
	
	function initVrfy() { 
	    // request for server
		// nothing effects renjian-deck
        try {
			var url = VRFY_URL + "?client_app_id=" + gClientAppId;
            gLoaders["vrfy"].load(getRequest(url, true, "", true));
			myTrace("Loading " + url);
        } catch(error) {
            myTrace('Unable to load VRFY_URL: ' + error);
        }
    }
    
    function onVrfySuccess(data) {
        myTrace("onVrfySuccess!");
        //var u = JSON.parse(data);
    }
    
    //----------------------------------------------------------------------
    
    function SocketOnError(e) {
        myTrace("SocketOnError!");
        gMsg.say("推送服务发生错误！");
        myTrace(e);    
    }
    
    function SocketOnConnect() {
        myTrace("SocketOnConnect!");
    }
    function SocketOnClose() {
        myTrace("SocketOnClose!");
        gMsg.say("推送服务已断开！");
    }
    
    function SocketOnData(json) {
        myTrace("SocketOnData!");
        myTrace(json);
        var num_mention = 0, 
            updatedCvsts = new Array(),
            info = JSON.parse(json);
        gServerTime = info.flushTime;
        if(info.command == "ping")
            return;
        for(i in info.messages){
            if(info.messages[i].messageType == "MENTION"){
                num_mention ++;
            } else if(info.messages[i].messageType == "CONVERSATION_MESSAGE"){
                updatedCvsts.push(info.messages[i].conversationId);
            }
        }
        if (num_mention > 0) {
            onMention(num_mention);
        }
        gStatuses["favl"].reset();
        doIt();
        resetAllCvstWindows(updatedCvsts);
    }
    
    function SocketReset() {
        myTrace("SocketReset!");
        gMsg.say("推送服务开始重联……");
    };

    //----------------------------------------------------------------------

    function onConversation(event){
        var id_info = parseParentNodeData(event);
        var id_status = id_info[0];
        var oUser = id_info[1];
        var id_cvst = id_info[4];
        
        // 判断对话是否存在
        // 初始化DIV时的id里会存入root_status_id，如果当时它还不是对话，那么null会被自动换为0
        // 所以首先要判断是否为0，这样可以减小确定是对话的开销。
        // 之后要去status里检查新的数据，如果最近100个status的root_id等于当前点击的ID，那就找到id了
        // 这个逻辑明显存在一个问题：
        // 假如某个对话的root_status在timeline的最新100条以内无人回复，那再去点击无法查到资料，会被认为无人回复
        /* ！这段代码不再需要了
        if(id_cvst == 0){
            tweets = gStatuses[gLoader].getStatuses();
            for(i in tweets){
                if (tweets[i].root_status_id == id_status) {
                    id_cvst = id_status;
                    break;
                }
            }
            if (id_cvst == 0 || id_cvst == null) {
                gMsg.say(oUser + "说的还没有形成对话，先第一个回应他吧～;)");
                return;
            }
        }*/
    
        myTrace("onConversation: " + id_cvst);
        
        var result = queryCvstWindow(id_cvst);
        myTrace("   --" + result);
        if (result == "NO_LOADER") {
            newCvstWindow(id_cvst);
        } else if (result == "NO_WINDOW"){
            openCvstWindow(id_cvst);
        } else {
            activeCvstWindow(id_cvst);
        }
    }
    
    function queryCvstWindow(cid){
        if (gCvstWindows[cid] == null)
            return "NO_LOADER";
        else if (gCvstWindows[cid].stage.nativeWindow.closed == true)
            return "NO_WINDOW";
        else
            return "EXIST";
    }
    
    function newCvstWindow(cid){
        var options = new air.NativeWindowInitOptions(); 
        options.systemChrome = air.NativeWindowSystemChrome.NONE; 
        options.type = air.NativeWindowType.NORMAL;
        options.transparent = true;
        var ww = air.Screen.mainScreen.bounds.width;  
        var hh = air.Screen.mainScreen.bounds.height;  
        var windowBounds = new air.Rectangle(
                (air.Capabilities.screenResolutionX - 300) / 2 + 200, 
                (air.Capabilities.screenResolutionY - 500) / 2 + 50,
                300, 500);
        var newHTMLLoader = air.HTMLLoader.createRootWindow(true, options, true, windowBounds);
        options = null; 
        newHTMLLoader.load(new air.URLRequest("chat.html"));
        newHTMLLoader.window.externOnLoad = function(){
            newHTMLLoader.window.chat.setUser(gUser);
            newHTMLLoader.window.chat.setPassword(gPass);
            newHTMLLoader.window.chat.setConversationId(cid);
            newHTMLLoader.window.chat.setTheme(gPrefs.themeName);
            newHTMLLoader.window.chat.init();
        }
        gCvstWindows[cid] = newHTMLLoader;
    }
    
    function openCvstWindow(cid){
        // 应当有更加节省开支的方式用已经存在的HTMLloader产生窗口
        // 当前简单的new一个HTMLloader替代原先的
        newCvstWindow(cid);
    }
    
    function activeCvstWindow(cid){
        gCvstWindows[cid].stage.nativeWindow.activate();
    }
    
    function resetAllCvstWindows(updatedCvsts){
        // 找到打开的窗口，不打开的直接释放掉
        for (var i in gCvstWindows) {
            if (gCvstWindows[i] == null) 
                continue;
            else if (gCvstWindows[i].stage.nativeWindow.closed == true) 
                gCvstWindows[i] = null;
            else {
                gCvstWindows[i].window.chat.setServerTime(gServerTime);
                // 找到打开窗口中更新了的
                for (j in updatedCvsts) { 
                    if (updatedCvsts[j] == i) {
                        gCvstWindows[i].stage.nativeWindow.notifyUser("hello");
                        gCvstWindows[i].window.chat.reset();
                        myTrace("reset Conversation: " + i);
                        break;
                    }
                }
            }
        }
    }
    
    //----------------------------------------------------------------------
    
    function onPicClick(event){
        myTrace("onPicClick. Picture: " + event.currentTarget);
        event.preventDefault();
        
        gPicbox.window.setUrl(event.currentTarget.href);
        gPicbox.window.showPic();
        return false;
    }
    
    function initPicbox(){
        if (gPicbox == null) {
            var options = new air.NativeWindowInitOptions();
            options.systemChrome = air.NativeWindowSystemChrome.NONE;
            options.type = air.NativeWindowType.LIGHTWEIGHT;
            options.transparent = true;
            var ww = air.Screen.mainScreen.bounds.width;
            var hh = air.Screen.mainScreen.bounds.height;
            var windowBounds = new air.Rectangle(0,0,ww,hh); 
            gPicbox = air.HTMLLoader.createRootWindow(true, options, true, windowBounds); 
            gPicbox.load(new air.URLRequest("facybox.html"));
            gPicbox.window.nativeWindow.alwaysInFront = true;
            gPicbox.window.nativeWindow.visible = false;
        }
    }

    //----------------------------------------------------------------------
    
    function onMention(count){
        notify( "@" + gUser, "有" + count + "条提到你(@" + gUser + ")的消息哦～");
    }
    
    function onHasUpdated(){
        // todo: 当socket有更新时
    }
    
    function notify(title,content,timeout){
        gNotify.window.setTitle(title);
        gNotify.window.setContent(content);
        gNotify.window.setTout(timeout || 5000);
        gNotify.window.show();
    }
    
    function initNotify(){
        if (gNotify == null) {
            var options = new air.NativeWindowInitOptions();
            options.systemChrome = air.NativeWindowSystemChrome.NONE;
            options.type = air.NativeWindowType.LIGHTWEIGHT;
            options.transparent = true;
            var ww = air.Screen.mainScreen.bounds.width;
            var hh = air.Screen.mainScreen.bounds.height;
            var windowBounds = new air.Rectangle(ww - 244, 30, 234, 123);
            gNotify = air.HTMLLoader.createRootWindow(true, options, true, windowBounds);
            gNotify.load(new air.URLRequest("notify.html"));
            gNotify.window.nativeWindow.alwaysInFront = true;
            gNotify.window.nativeWindow.visible = false;
        } 
    }
    
    //----------------------------------------------------------------------
    
    function onOntop(event){
        gPrefs.onTop = !gPrefs.onTop;
        myTrace("onOntop " + gPrefs.onTop);
        if (gPrefs.onTop) {
            $("#miontop").text("取消最前");
            nativeWindow.alwaysInFront = true;
        } else {
            $("#miontop").text("保持最前");
            nativeWindow.alwaysInFront = false;
        }
        setPrefs();
        drawStatuses();
    }
    
    //----------------------------------------------------------------------
	
	function onUserTimeline(event){
		oUser = event.target.pathname.replace("/", "")

        myTrace("onUserTimeline: " + oUser);
        
        newUserWindow(oUser);
		return false;
    }
	
    function newUserWindow(uid){
        var options = new air.NativeWindowInitOptions(); 
        options.systemChrome = air.NativeWindowSystemChrome.NONE; 
        options.type = air.NativeWindowType.NORMAL;
        options.transparent = true;
        var ww = air.Screen.mainScreen.bounds.width;  
        var hh = air.Screen.mainScreen.bounds.height;  
        var windowBounds = new air.Rectangle(
                (air.Capabilities.screenResolutionX - 300) / 2 + 200, 
                (air.Capabilities.screenResolutionY - 500) / 2 + 50,
                300, 500);
        var newHTMLLoader = air.HTMLLoader.createRootWindow(true, options, true, windowBounds);
        options = null; 
        newHTMLLoader.load(new air.URLRequest("user.html"));
        newHTMLLoader.window.externOnLoad = function(){
            newHTMLLoader.window.user.setUser(gUser);
            newHTMLLoader.window.user.setPassword(gPass);
            newHTMLLoader.window.user.setUserId(uid);
            newHTMLLoader.window.user.setTheme(gPrefs.themeName);
            newHTMLLoader.window.user.init();
        }
        gUserWindows[uid] = newHTMLLoader;
    }
    
	//----------------------------------------------------------------------

    function init() {
        var parser, xml_obj, root, iconLoad, iconMenu, exitCmd,
            moveable, i;

        // Window min/max dimensions
        window.nativeWindow.minSize = new air.Point(250, 400);
        window.nativeWindow.maxSize = new air.Point(1200, 1200);

        // Get app name and version from configuration XML file
        parser = new DOMParser(); 
        xml_obj = parser.parseFromString(
            air.NativeApplication.nativeApplication.applicationDescriptor,
            "text/xml"); 
        root = xml_obj.getElementsByTagName("application")[0]; 
        gAppVersion = root.getElementsByTagName("version")[0].firstChild.data; 
        gAppName = root.getElementsByTagName("filename")[0].firstChild.data; 
        
        setTitle(gAppName);
        $("#abouttitle").text(gAppName);
        $("#aboutversion").text(gAppVersion);

        // System tray
        if (air.NativeApplication.supportsSystemTrayIcon) {
            iconMenu = new air.NativeMenu(); 
            exitCmd = iconMenu.addItem(new air.NativeMenuItem("退出")); 
            exitCmd.addEventListener(air.Event.SELECT, onExit); 
            iconLoad = new air.Loader(); 
            iconLoad.contentLoaderInfo.addEventListener(
                air.Event.COMPLETE, function (event) {
                    air.NativeApplication.nativeApplication.icon.bitmaps =
                        [event.target.content.bitmapData]; 
                }); 
            iconLoad.load(new air.URLRequest("/icons/icon16.png")); 
            air.NativeApplication.nativeApplication.icon.tooltip = gAppName;
            air.NativeApplication.nativeApplication.icon.menu = iconMenu;
            air.NativeApplication.nativeApplication.icon.addEventListener(
                "click", function (event) {
                    myTrace("Systray click");
                    air.NativeApplication.nativeApplication.activate();
                    window.nativeWindow.activate();
                });
        } 
        
        // Assign moveable div's so we can drag the window around.
        moveable = [
            "#dvtitlebar", "#dvcontainer",
            "#dvthrobber", "#dvabout", "#dvlogin"
        ];
        for (i = 0; i < moveable.length; i++) {
            $(moveable[i]).mousedown(onMove);
        }

        // Assign event listeners
        $("#dvgripper").mousedown(onResize);
        $("#bnsignin").click(onSignin);
        $("#inusernm").keypress(function (e) {
            if (e.charCode === 13) onSignin();
        });
        $("#inpasswd").keypress(function (e) {
            if (e.charCode === 13) onSignin();
        });
        $("#bnaboutok").click(function () {
            $("#dvabout").slideUp();
        });
        $("#bnthemeok").click(function () {
            $("#dvthememenu").slideUp("fast");
        });
        $("#dvexit").click(onTrayIconize);
        $("#dvmin").click(onMinimize);
        $("#dvtoggle").click(onToggleInputArea);
        $("#bnupdatesend").click(onUpdate);
        $("#dvupdateinput").keypress(function (e) {
             if (e.ctrlKey && e.which == 13 || e.which == 10) {
			 	onUpdate();
			 	return false;
			 }
        });
        $("#dvurl").click(shareLink);
        $("#inurl").keypress(function (e) {
            if (e.charCode === 13) shareLink();
        });
        $("#infilter").keyup(doFilter);
        $("#inurl,#infilter,#urltitle")
            .focus(function () {
                if ($(this).val() === $(this)[0].title) {
                    $(this).toggleClass("inputfaint", false);
                    $(this).val("");
                }
            })
            .blur(function () {
                if ($.trim($(this).val()) === "") {
                    $(this).toggleClass("inputfaint", true);
                    $(this).val($(this)[0].title);
                }
            })
            .blur();
        $("#bnsharelink").click(function () {
            if ($("#inurl,#dvurl").is(":hidden") && $("#urltitle,#dvurlcncl").is(":hidden")) {
                gStatusType = "LINK";
                $("#inurl,#dvurl").fadeIn(speed = 200);
                $("#inurl").focus();
            } else if ($("#inurl,#dvurl").is(":visible") && $("#urltitle,#dvurlcncl").is(":hidden")) {
                gStatusType = "TEXT";
                $("#inurl,#dvurl").fadeOut(speed = 200);
            } else if ($("#inurl,#dvurl").is(":hidden") && $("#urltitle,#dvurlcncl").is(":visible")) {
                gStatusType = "TEXT";
                $("#urltitle,#dvurlcncl").fadeOut(speed = 200);
            } else { // 应该不存在
                gStatusType = "TEXT";
                $("#inurl,#dvurl,#urltitle,#dvurlcncl").fadeOut(speed = 200);
            }
        });
        $("#dvurlcncl").click(function () {
            gStatusType = "TEXT";
            gOriginalUrl = null;
            gLinkTitle = null;
            gLinkDesc = null;
            $("#urltitle, #dvurlcncl").fadeOut(speed = 200);
        });
        //$("#dvtimeline div").live("click", onConversation);
        $(".dvtweet").live("click", onConversation);
		$(".user_link").live("click", onUserTimeline);
        /*$("#minotify").click(function(){
            onMention(5);
        });*/
        
        window.htmlLoader.filters = window.runtime.Array(
            new window.runtime.flash.filters.DropShadowFilter(
                0, 90, 0, 1, 3, 3));

        window.nativeWindow.addEventListener(
            air.NativeWindowBoundsEvent.RESIZE, onMoveResize);
        window.nativeWindow.addEventListener(
            air.NativeWindowBoundsEvent.MOVE, onMoveResize);

        air.NativeApplication.nativeApplication.addEventListener(
            air.InvokeEvent.INVOKE, function (event) {
                myTrace("Dock click");
                air.NativeApplication.nativeApplication.activate();
                window.nativeWindow.activate();
            });

        setUpMainMenu();

        // URL loaders for Twitter actions
        gLoaders["home"] = loader(onLoadSuccess);
        gLoaders["repl"] = loader(onLoadSuccess);
        gLoaders["pblc"] = loader(onLoadSuccess);
        gLoaders["msgs"] = loader(onLoadSuccess);
        gLoaders["dmsg"] = loader(onUpdtSuccess);
        gLoaders["updt"] = loader(onUpdtSuccess);
        gLoaders["cfav"] = loader(onCFavSuccess);
        gLoaders["dfav"] = loader(onDFavSuccess);
        gLoaders["favl"] = loader(onLoadSuccess);
        gLoaders["push"] = loader(onPushSuccess);
        gLoaders["user"] = loader(onUserSuccess);
        gLoaders["vrfy"] = loader(onVrfySuccess);

        // State info for Twitter statuses
        gStatuses["home"] = status(HOME_URL);
        gStatuses["repl"] = status(REPL_URL);
        gStatuses["pblc"] = status(PBLC_URL);
        gStatuses["msgs"] = status(MSGS_URL);
        gStatuses["favl"] = status(FAVL_URL);
        
        gMsg = msg();
        initNotify();
        initPicbox();

        getPrefs();
        loadTheme(gPrefs.themeName);
        $("#miavatars").text(gPrefs.showAvatars ? 
            "隐藏头像" : "显示头像");
        $("#miinput").text(gPrefs.alwaysShowUpdate ?
            "隐藏输入" : "显示输入");
        if (gPrefs.bounds) {
            window.nativeWindow.bounds = new air.Rectangle(
                gPrefs.bounds[0] < 0 ? ((air.Capabilities.screenResolutionX - 300) / 2) : gPrefs.bounds[0], 
                gPrefs.bounds[1] < 0 ? ((air.Capabilities.screenResolutionY - 500) / 2) : gPrefs.bounds[1],
                gPrefs.bounds[2] < 0 ? 300 : gPrefs.bounds[2], 
                gPrefs.bounds[3] < 0 ? 500 : gPrefs.bounds[3]);
        }
        if (gPrefs.user && gPrefs.pass) {
            gUser = gPrefs.user;
            gPass = gPrefs.pass;
            doIt();
			initVrfy();
            initPusher();
        } else {
            showLogin(false);
        }
        if (gPrefs.startAtLogin){
        	air.NativeApplication.nativeApplication.startAtLogin = true;
        } else {
        	air.NativeApplication.nativeApplication.startAtLogin = false;
        }
        
        window.setTimeout(function () {
            window.nativeWindow.visible = true;
        }, 500);
    }

    function ini() {
        var a, b, appUpdater;
        // Set up updater framework
        appUpdater = new runtime.air.update.ApplicationUpdaterUI();
        appUpdater.updateURL = "http://deck.renjian.me/update.xml"; 
        appUpdater.delay = 1;
        appUpdater.isCheckForUpdateVisible = false;
        appUpdater.initialize();
        a = new air.NativeWindowInitOptions(); 
        a.systemChrome = air.NativeWindowSystemChrome.NONE; 
        //a.type = air.NativeWindowType.LIGHTWEIGHT;
        a.type = air.NativeWindowType.NORMAL;
        a.maximizable = false;
        a.minimizable = true;
        a.transparent = true;
        b = air.HTMLLoader.createRootWindow(false, a, false, 
            new air.Rectangle(
                (air.Capabilities.screenResolutionX - 300) / 2, 
                (air.Capabilities.screenResolutionY - 500) / 2,
                300, 500));
        b.load(new air.URLRequest("htmls/app.html"));
    }

    //----------------------------------------------------------------------
    
    return {
        ini: ini,
        init: init,
        onUpdateChange: onUpdateChange,
        SocketOnError: SocketOnError,
        SocketOnConnect: SocketOnConnect,
        SocketOnClose: SocketOnClose,
        SocketOnData: SocketOnData,
        SocketReset: SocketReset
    };

}();
