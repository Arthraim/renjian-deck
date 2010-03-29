﻿/**
 * renjian-deck.user
 * Mar 22 2010
 * Arthur Wang
 */
var user = function(){
	
	var REFRESH_MS = 120000,
        MAX_STATUSES = 50,
        PREFS_FILE = "prefs_usr.json",
        SRCH_URL = "http://renjian.com/dd/label_timeline.html?label=",
        ROOT_URL = "http://renjian.com/",
        TWTR_URL = "http://api.renjian.com/",
        UPDT_URL = TWTR_URL + "statuses/update.json",
        CFAV_URL = TWTR_URL + "favorites/create/",
        DFAV_URL = TWTR_URL + "favorites/destroy/",
		USER_URL = TWTR_URL + "statuses/user_timeline.json" 
        
        gReplRegex = /^@\w+\s/,      // match replies in update input
        gDmsgRegex = /^d\s(\w+)\s/,  // match dm's in update input
        gTailRegex = /[.,!?)]*$/ig,  // match .,!?) after url for inline links
        
        gMsg = null,
        gPicbox = null,
        
        gUserId = null,
        gInReplyToStatusId = null,
        
        gUser = null, 
        gPass = null,
        
        gThemeName = "rensea",
        gServerTime = null,
           
        imgCache = {},
     
        gLoaders = {}, // updt, cfav, dfav, user
        gStatuses = {},
        
        gTimer = null,
        gLoader = "user", // home, repl, msgs, user
        gShowInput = false,
        gDmUserId = null,
        
        gStatusType = "TEXT",
        gOriginalUrl = null,
        gLinkTitle = null,
        gLinkDesc = null,
		gUserWindows = new Array(),
        
        gPrefsTimer = null,
        gPrefs = {
            showAvatars: true,
        };

    //-----------------------------------------------------------------------
    
    function myTrace(str) {
        // comment out the following line for distribution builds
        air.trace("   --user:" + gUserId + " : " + str);
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
            statuses = statuses.concat(newStatuses);
            //statuses.splice(MAX_STATUSES);
            if (statuses.length > 0) {
                since_id = statuses[statuses.length-1].id;
            }
            //statuses = newStatuses;
        }
        
        function getURL() {
            var url = baseURL +  "?id=" + gUserId + 
							     "&count=" + MAX_STATUSES + 
				                 "&since_id=" + since_id;
            return url;
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
                setTitle("用户：" + gUserId);
                onSuccess(event.target.data);
            } else if (status == 400 || status == 403) {
                data = JSON.parse(event.target.data);
                if (data && data.error) {
                    gMsg.say("人间网返回错误: " + data.error);
                }
            } else if (status == 401) {
                showLogin(true);
            } else if (status == 404) {
                myTrace("人间网返回 404 Not Found error.");
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
            
        function removeEventListeners(){
            ldr.removeEventListener(air.IOErrorEvent.IO_ERROR, onError);
            ldr.removeEventListener(air.Event.COMPLETE, onComplete);
            ldr.removeEventListener(air.HTTPStatusEvent.HTTP_RESPONSE_STATUS, 
                onStatus);
        }

        return {
            load: load,
            removeEventListeners: removeEventListeners,
        };  
    }

    //-----------------------------------------------------------------------

    function getRequest(url, isPost, data) {
        var req = new air.URLRequest(url);
        req.requestHeaders.push(new air.URLRequestHeader("Authorization", 
            "Basic " + Base64.encode(gUser + ":" + gPass)));
        req.authenticate = false;
        req.manageCookies = false;
        req.method = 
            isPost ? air.URLRequestMethod.POST : air.URLRequestMethod.GET;
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
    
    function onMoveResize(event) {
        if (gPrefsTimer) {
            window.clearTimeout(gPrefsTimer);
        }
        gPrefsTimer = window.setTimeout(function () {   
            saveBounds();
        }, 4000);
    }
    
    function onClose(event){
        saveBounds();
        
        // 关闭前要做大量的GC工作
        // 关闭子窗体
        gPicbox.parent.nativeWindow.close();
        // removeEventListeners
        for(i in gLoaders){
            gLoaders[i].removeEventListeners();
        }
        window.nativeWindow.removeEventListener(
            air.NativeWindowBoundsEvent.RESIZE, onMoveResize);
        window.nativeWindow.removeEventListener(
            air.NativeWindowBoundsEvent.MOVE, onMoveResize);

        air.NativeApplication.nativeApplication.removeEventListener(
            air.InvokeEvent.INVOKE, function (event) {
                myTrace("Dock click");
                air.NativeApplication.nativeApplication.activate();
                window.nativeWindow.activate();
            });
        
        // 清空一些全局变量
        gLoader = null;
        gStatuses = null;
        imgCache = {};
        imgCache = null;
        
        air.NativeApplication.nativeApplication.activeWindow.close(); 
    }
            
    function onExit(event) {
        saveBounds();
        air.NativeApplication.nativeApplication.icon.bitmaps = []; 
        air.NativeApplication.nativeApplication.exit();
    }

    function onLinkClick(event) {
        myTrace("called onLinkClick. navigateToURL: " + event.currentTarget);
        event.preventDefault();
        air.navigateToURL(new air.URLRequest(event.currentTarget));
    }

    function setTitle(title) {
        document.title = title;
        $("#dvtitlebar").text(title);
    }

    //-----------------------------------------------------------------------

    function showMain() {
        $("#dvabout").hide();
        $("#dvlogin").hide();
        $("#dvmain").show();
    }
    
    //-----------------------------------------------------------------------

    function loadTheme(theme) {
        theme = theme || "rensea";
        $("#ss")[0].href = "../themes/" + theme + "/styles.css";
        loadAllWindowsTheme(theme);
    }
    
    function loadAllWindowsTheme(theme) {
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

    //-----------------------------------------------------------------------

    function onUpdateChange(event) {
        var len = 140 - $("#dvupdateinput").val().length,
            dmsgMatch;
        $("#dvupdatecount").text(len);
        if (gReplRegex.test($("#dvupdateinput").val())) {
            $("#bnupdatesend").text("回应");
        } else {
            $("#bnupdatesend").text("发送");
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
            $("#inurl,#dvurl,#urltitle,#dvurlcncl").fadeOut(speed);
        }
    }

    function onToggleInputArea(event) {
        setShowInput(!gShowInput);
        showUpdateArea(gShowInput);
    }
    
    function setShowInput(showInput){
        gShowInput = showInput;
    }

    //-----------------------------------------------------------------------

    function parseParentNodeData(event) {
        // structure of id attribute of .dvtweet is...
        //   id:;user:;fav:;txt
        //   :; was chosen as the delimiter because hopefully(!?) it's unique
        // the buttons are inside .btncontainer which is inside .dvtweet,
        //   hence parentNode.parentNode...
        return event.target.parentNode.parentNode.id.split(":;");
    }

    function onFav(event) {
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
        var id_user = parseParentNodeData(event);
        gInReplyToStatusId = id_user[0];
        $("#dvupdateinput").val("@" + id_user[1] + " ");
        onUpdateChange();
        setShowInput(true);
        showUpdateArea(gShowInput);
    }

    //-----------------------------------------------------------------------

    function onLoadSuccess(data) {
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
        
        //gStatuses[gLoader].reset();
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
        } else if (!gReplRegex.test($("#dvupdateinput").val())) {
			txt = "@" + gUserId + " " + txt;
		}
        vars = new air.URLVariables();
        vars["source"] = "人间浮云";
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
        
        //setTitle("@" + tweets[0].user.screen_name + ": " + tweets[0].text);

        $("#dvtimeline").empty();

        if (tweets.length == 0) {
            $("#dvtimeline")
                .append($("<div></div>")
                    .css("padding", "10px")
                    .html("啥也没有的说～"));
            return;
        }
		
		// user infomation
		dvtweet = generateUserHtml(tweets[0]);
        $("#dvtimeline").append(dvtweet);

        for (i = 0; i < tweets.length; i++) {
            dvtweet = generateHtml(tweets[i]);
            $("#dvtimeline").append(dvtweet);
        }
        $(".link").click(onLinkClick);
        $(".pic").click(onPicClick);
        $(".tweetpic").toggle(gPrefs.showAvatars);
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
            .html("<div class='onavators'><div class='t_status fl'>" +
                  "<div class='s_north'>" +
                  "  <div class='sn_user fl'><a href='" + ROOT_URL + user + "' " +
                  "    class='user_link screenname gender" + gender + "'>" + user +
                  (name?" (" + name + ")":"") + "</a></div>" +
                  "  <div class='sn_date fr'><a href='" + ROOT_URL + user + "/status/" + id + "' " + 
                  "    class='link prettyDate'>" + relative_when + "</a></div>" + "</div>" + 
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
	
	function generateUserHtml(tweet) {
       var created_at = tweet.user.created_at,
	       description = tweet.user.description,
		   favourites_count = tweet.user.favourites_count,
		   followers_count = tweet.user.followers_count,
		   following_count = tweet.user.following_count,
		   gender = tweet.user.gender,
		   id = tweet.user.id,
		   is_followed_me = tweet.user.is_followed_me,
		   is_following = tweet.user.is_following,
		   name = tweet.user.name,
		   profile_image_url = tweet.user.profile_image_url,
		   score = tweet.user.score,
		   screen_name = tweet.user.screen_name,
		   url = tweet.user.url;
	
	   var gendertxt;
	   if (gender == 0) gendertxt = "保密";
	   else if (gender == 1) gendertxt = "男";
	   else gendertxt = "女";	   
	   
	   setTitle("@" + screen_name + "(" + name + ")");
	
	   dvuser = $("<div class='relative'></div>")
            .addClass("dvuser")
            //.attr("id", id + ":;" + user + ":;" + favorited + ":;" + rawtxt + ":;" + root_status_id)
            .html(
			    "<div class='dvuserpic absolute'><img src='" + profile_image_url.replace("120x120", "72x72") + "'></div>" +
				"<a href='http://renjian.com/" + screen_name + "' class='screenname gender" + gender + " link'>" + 
				screen_name + "(" + name + ")</a>" + "<br/>" +
				"金币: " + score + "<br/>" +
				"我关注的: " + following_count + "  " + "关注我的: " + followers_count + "<br/>" +
				"网站: " + "<a href='" + url + "' class='link'>" + url + "</a>" + "<br/>" +
				"性别: " + gendertxt + "<br/>" +
				"简介: " + description + "<br/>" +
				"<div class='clear'></div>"
             );
		return dvuser;
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
            $("#mihome,#mirepl,#mipblc,#mimsgs").css("font-weight", "normal");
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
            hideMenu();
        });
        $(".menuitem").click(function () {
            hideMenu(true);
        });
        $("#mirefresh").click(function () {
            gStatuses[gLoader].reset();
            doIt();
        });
        $("#miclose").click(onClose);
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
    
    function onPicClick(event){
        myTrace("called onPicClick. Picture: " + event.currentTarget);
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
    
    //-----------------------------------------------------------------------
        
    function setUser(u){
        gUser = u;
    }
    
    function setPassword(p){
        gPass = p;
    }
    
    function setUserId(u){
        gUserId = u;
    }
    
    function setTheme(theme){
        gThemeName = theme;
    }
    
    function setServerTime(serverTime){
        gServerTime = serverTime;
    }
    
    function reset(){
        //gStatuses[gLoader].reset();
        doIt();
    }
    
    //-----------------------------------------------------------------------

    function init() {
        var parser, xml_obj, root, iconLoad, iconMenu, exitCmd,
            moveable, i;

        // Window min/max dimensions
        window.nativeWindow.minSize = new air.Point(300, 500);
        window.nativeWindow.maxSize = new air.Point(1200, 1200);

        setTitle("用户：" + gUserId);

        // Assign moveable div's so we can drag the window around.
        moveable = [
            "#dvtitlebar", "#dvcontainer",
            "#dvthrobber"
        ];
        for (i = 0; i < moveable.length; i++) {
            $(moveable[i]).mousedown(onMove);
        }

        // Assign event listeners
        $("#dvgripper").mousedown(onResize);
        $("#dvexit").click(onClose);
        $("#dvmin").click(onMinimize);
        $("#dvtoggle").click(onToggleInputArea);
        $("#bnupdatesend").click(onUpdate);
        $("#dvupdateinput").keypress(function (e) {
            if (e.charCode === 13) onUpdate();
        });
        $("#dvurl").click(shareLink);
        $("#inurl").keypress(function (e) {
            if (e.charCode === 13) shareLink();
        });
        $("#inurl,#urltitle")
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
        $("#dvtitlebar").dblclick(onClose);
		$(".user_link").live("click", onUserTimeline);
        
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
		gLoaders["user"] = loader(onLoadSuccess);
        gLoaders["updt"] = loader(onUpdtSuccess);
        gLoaders["cfav"] = loader(onCFavSuccess);
        gLoaders["dfav"] = loader(onDFavSuccess);

        // State info for Twitter statuses
		gStatuses["user"] = status(USER_URL);
        
        gMsg = msg();
        initPicbox();

        getPrefs();
        loadTheme(gThemeName);
        if (gPrefs.bounds) {
            window.nativeWindow.bounds = new air.Rectangle(
                gPrefs.bounds[0] < 0 ? ((air.Capabilities.screenResolutionX - 300) / 2 + 200) : gPrefs.bounds[0], 
                gPrefs.bounds[1] < 0 ? ((air.Capabilities.screenResolutionY - 500) / 2 + 50) : gPrefs.bounds[1],
                gPrefs.bounds[2] < 0 ? 300 : gPrefs.bounds[2], 
                gPrefs.bounds[3] < 0 ? 500 : gPrefs.bounds[3]);
        }
        if (gUser == null || gPass == null) {
            gMsg.say("oops,登录信息错误");
        } else {
            doIt();
        }
                
        window.setTimeout(function () {
            window.nativeWindow.visible = true;
        }, 500);
    }

    //----------------------------------------------------------------------
    
    return {
        init: init,
        onUpdateChange: onUpdateChange,
        setUser: setUser,
        setPassword: setPassword,
        setUserId: setUserId,
        setTheme: setTheme,
        setServerTime: setServerTime,
        reset: reset,
        loadTheme: loadTheme,
    };
	
}();