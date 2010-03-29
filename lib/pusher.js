/**
 * renjian-deck
 * Nov 5 2009
 * Arthur Wang
 */

var pusher = function(){
    var socket = new air.Socket();
    var port = 9999
    var host = "message.renjian.com";
    var userId;
    var messageType;
    var pingId;
    
    function begin(){
        if (socket != null && socket.connected) 
            return;
        
        userId = userId;
        messageType = messageType || "['STATUS','MENTION','CONVERSATION_MESSAGE']";
        // "['STATUS','SCORE_CHANGE','COUNT_UPDATE','MENTION','CONVERSATION_MESSAGE']";
        try {
            socket.addEventListener(air.Event.CONNECT, onConnect);
            socket.addEventListener(air.Event.CLOSE, onClose);
            socket.addEventListener(air.ProgressEvent.SOCKET_DATA, onData);
            socket.addEventListener(air.IOErrorEvent.IO_ERROR, onError);
            socket.addEventListener(air.SecurityErrorEvent.SECURITY_ERROR, onSecurityError);
            socket.connect(host, port);
        } catch (error) {
            SocketOnError(error);
            reset();
        }
        //send(send);
        //close(close);
        myTrace("Pusher socket open!");
    }
    
    function ping() {
        var pingStr = "[{command:'ping', userId:'" + userId + "'}]";
        send(pingStr);
    }
    
    function onConnect (event) {
        ada.SocketOnConnect();
        var authentication = "[{command:'authentication', userId:'" + userId + "'," +
                             "messageTypes:" + messageType + "," +
                             "clientType:'renjian-deck'}]";
        send(authentication);
        pingId = setInterval(ping, 1000*120);
    }
    
    function onClose(event) {
        ada.SocketOnClose();
        if(pingId) {
            clearInterval(pingId);
        }
        reset();
    }
    
    function onError(event) {
        ada.SocketOnError("IOError:" + event.toString());
        reset();
    }
    
    function onSecurityError(event) {
        ada.SocketOnError("SecurityError"+event.toString());
        reset();
    }
    
    function onData(event) {
        ada.SocketOnData(socket.readUTFBytes(socket.bytesAvailable));
    }
    
    function reset() {
        ada.SocketReset();
        setTimeout(begin, 1000*3);
    }
    
    function close() {
        if(socket != null && socket.connected)
            socket.close();
        myTrace("Pusher socket close!");
    }
    
    function send(auth) {
        myTrace("Sent! " + auth);
        socket.writeUTFBytes(auth);
        socket.flush();
    }
        
    //--------------------------------------------------------------------------
    
    function myTrace(str) {
        air.trace(str);
    }
    
    //--------------------------------------------------------------------------
    
    function setUser(varId){
        myTrace("called setUser! " + varId);
        userId = varId;
    };
    
    function setMessageTypes(varTypes) {
        myTrace("called setMessageTypes! " + varTypes);
        messageType = varTypes;
    }
    
    /*
    function setHost(varHost){
        myTrace("called setHost!" + varHost);
        host = varHost;
    }
    */

    return {
        begin: begin,
        close: close,
        setUser: setUser,
        setMessageTypes: setMessageTypes
    };
    
}();

