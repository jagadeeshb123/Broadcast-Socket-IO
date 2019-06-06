import FTXBroadcastMessage from "./message";
import FTXLogoutModal from "./logout-modal";
import FTXLoginModal from "./login-modal";

/**
 * Socket Connection, Broadcasting And Listening Events
 *
 * @param {Object} params
 * @param {Object} query
 * @param {Number|String} port
 * @returns {FTXSocket}
 * @constructor
 */
function FTXSocket(params, query, port)
{
    this.defaultParams = {
        reconnection            : true,
        reconnectionDelay       : 60000,
        reconnectionDelayMax    : 60000,
        randomizationFactor     : 0,
        origins                 : '*:*',
        transports              : ['websocket', 'xhr-polling']
    };

    this.params             = jQuery.extend(true, this.defaultParams, params);
    this.params             = jQuery.extend(true, this.params, {query: query});
    this.query              = query;
    this.hostName           = window.location.hostname;
    this.port               = port && !isNaN(port) ? port : 3030;
    this.logoutModal        = new FTXLogoutModal(this);
    this.loginModal         = new FTXLoginModal(this);
    this.canShowModal       = true;

    this.init(query['id'], query['role'], query['tokenValue']);

    return this;
}

/**
 * Debug Message (When Debug Mode True)
 *
 * @param {String} title
 * @param {String} message
 */
FTXSocket.prototype.debugMessage = function(title, message)
{
    if(window['socketDebug'] === true)
    {
        console.log(title, message);
    }
};

/**
 * Initialize Socket
 *
 * @param {Number} _id
 * @param {String} _role
 * @param {String}_tokenValue
 */
FTXSocket.prototype.init = function (_id, _role, _tokenValue)
{
    this.debugMessage('Init', 'Initializing Socket Library');

    this.initializeSocket(_id, _role, _tokenValue);
    this.startBindings(_id, _role, _tokenValue);
};

/**
 * Initialize Socket Connection
 *
 * @param {Number} _id
 * @param {String} _role
 * @param {String}_tokenValue
 */
FTXSocket.prototype.initializeSocket = function (_id, _role, _tokenValue)
{
    this.socket = io(this.hostName + ':' + this.port, this.params);

    var token = document.querySelector('[name="_token"]');

    if(token)
    {
        this.debugMessage('Token', 'Socket Token: ' + token);
        this.socket.emit('socket_CSRFToken_' + _id + '_' + _role + '_' + _tokenValue, token.content);
    }
    else
    {
        this.debugMessage('Token', 'No Socket Token Found...');
    }
};

/**
 * Start Bindings
 *
 * @param {Number} _id
 * @param {String} _role
 * @param {String}_tokenValue
 */
FTXSocket.prototype.startBindings = function (_id, _role, _tokenValue)
{
    var context = this;

    this.socket.on('ping', function ()
    {
        socketFTX.socket.emit('socket_ping_'+ _id + '_' + _role + '_' + _tokenValue);
    });

    this.socket.on('socket_newBrowserTabConnected_' + _id + '_' + _role + '_' + _tokenValue, function (newCSRFToken)
    {
        context.debugMessage('Alert', 'New tab connected for ID: ' + _id + ' and role: ' + _role);

        if(context.logoutModal.logoutTimerModal)
        {
            context.logoutModal.logoutTimerModal.close();
        }

        if(context.loginModal.loginModal)
        {
            context.loginModal.loginModal.close();
            context.loginModal.loginModal.setBodyContents('');
        }

        clearInterval(context.logoutModal.secondsTimer);

        if(newCSRFToken && newCSRFToken !== _tokenValue)
        {
            context.debugMessage('CSRF', 'Applying new CSRF Token: ' + newCSRFToken);
            context.updateCsrfToken(_id, _role, newCSRFToken);
        }

        context.canShowModal = true;
    });

    this.socket.on('socket_showLogoutTimerModal_' + _id + '_' + _role + '_' + _tokenValue, function ()
    {
        context.debugMessage('Alert', 'Showing Logout Timer Modal for ID: ' + _id);
        context.debugMessage('Alert', 'CanShowModal: ' + (context.canShowModal === true ? 'Yes' : 'No'));

        if(context.canShowModal === true)
        {
            context.logoutModal.getLogoutModal(_id, _role, _tokenValue);
            context.logoutModal.logoutTimerModal.open();

            context.canShowModal = false;
        }
    });

    this.socket.on('socket_stayLogin_' + _id + '_' + _role + '_' + _tokenValue, function ()
    {
        context.debugMessage('Alert', 'Received Stay Login for ID: ' + _id);

        if(context.logoutModal.logoutTimerModal)
        {
            context.logoutModal.logoutTimerModal.close();
        }

        clearInterval(context.logoutModal.secondsTimer);

        context.canShowModal = true;
    });

    this.socket.on('socket_userLoggedOut_' + _id + '_' + _role + '_' + _tokenValue, function ()
    {
        context.debugMessage('Alert', 'Received Logged Out Alert for ID: ' + _id);

        if(context.logoutModal.logoutTimerModal)
        {
            context.logoutModal.logoutTimerModal.close();
        }

        clearInterval(context.logoutModal.secondsTimer);

        context.loginModal.getLoginModal(_id, _role, _tokenValue);
        context.loginModal.loginModal.open();

        context.canShowModal = false;
    });

    this.socket.on('socket_forceLogout_' + _id + '_' + _role + '_' + _tokenValue, function ()
    {
        context.debugMessage('Alert', 'Received Force Logout for ID: ' + _id);

        if(context.logoutModal.logoutTimerModal)
        {
            context.logoutModal.logoutTimerModal.close();
        }

        context.logoutModal.logOutUser(_id, _role, _tokenValue);

        context.canShowModal = false;
    });

    this.socket.on('socket_reloadPage_' + _id + '_' + _role + '_' + _tokenValue, function (dashboardLink)
    {
        context.debugMessage('Alert', 'Received Reload Event for ID: ' + _id);
        window.location = dashboardLink;
    });

    this.socket.on('disconnect', function ()
    {
        console.log('Client Disconnected...');
    });

    this.socket.on('connect_failed', function ()
    {
        console.log('Could not connect to socket source');
    });

    // Run broadcast message toaster event
    this.socket.on('socket_redisBroadcast_' + _id + '_' + _role, function (data)
    {
        context.debugMessage('Broadcast', data);

        if(data)
        {
            new FTXBroadcastMessage(data).run();
        }
    });
};

/**
 * Update All CSRF Tokens
 *
 * @param {Number} _id
 * @param {String} _role
 * @param {String} _newTokenValue
 */
FTXSocket.prototype.updateCsrfToken = function(_id, _role, _newTokenValue)
{
    jQuery.ajaxSetup({ headers: {'X-CSRF-TOKEN' : _newTokenValue}});

    var tokenElements = document.querySelectorAll('[name="_token"]');

    if(tokenElements && tokenElements.length)
    {
        for(var t = 0; t < tokenElements.length; t++)
        {
            tokenElements[t].content = _newTokenValue;
            tokenElements[t].value = _newTokenValue;
        }
    }

    this.socket.disconnect();

    window.socketFTX = new FTXSocket({}, {
        'id'            : _id,
        'role'          : _role,
        'tokenValue'    : _newTokenValue
    }, this.port);
};

export default FTXSocket;
