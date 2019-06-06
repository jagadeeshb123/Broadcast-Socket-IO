/**
 * Socket IO Node JS Server
 *
 * @author Jagadeesh Battula jagadeesh@goftx.com
 * @type {*|Function}
 */
let app         = require('express')(),
    http        = require('http').Server(app),
    io          = require('socket.io')(http, {pingInterval: 60000, origins: '*:*', transports: ['websocket', 'xhr-polling']}),
    fs          = require('fs'),
    cmd         = require('node-cmd'),
    Redis       = require('ioredis'),
    redis       = new Redis(),
    socketPort  = (!process.argv[2] || isNaN(process.argv[2])) ? 3030 : parseInt(process.argv[2]),
    socketHost  = (process.argv[3] && process.argv[3] !== '') ? process.argv[3] : 'controlcenter_ftx',
    isWin       = process.platform === "win32";

// Start listening on defined port from argument, or 3030 (default)
startListening(socketPort);

/**
 * Start Listening For Socket IO Connection Requests
 *
 * @param port
 */
function startListening(port)
{
    if(http && http.listen)
    {
        http.listen(port, function ()
        {
            console.log('Socket IO listening on port : ' + port);
            fs.unlink(__dirname + '/active-users.json', (err) => {});
        });
    }
}

/**
 * Socket IO Home Page
 *
 */
app.get('/', function (req, res)
{
    console.log('Socket IO Home Page');
    res.send('<h1>Socket IO Home Page</h1>');
});

/**
 * Redis Subscribe On Channels Listen For Message Event
 *
 */

redis.subscribe('redis-broadcast-' + socketHost, 'logout-alert-' + socketHost, function(err, count)
{
    console.log('Redis listening on port :6379. Currently subscribed to ' + count + ' channels.');
});

redis.on('error', err => {
    console.log(err);
});

/**
 * On Connection Event Socket IO
 *
 */
io.on('connection', function (socket)
{
    let handshakeTime   = convertDate(socket.handshake.time),
        userAgent       = socket.handshake.headers['user-agent'],
        role            = (socket.handshake.query['role'] === 'user') ? 'user' : 'employee',
        id              = socket.handshake.query['id'],
        tokenValue      = socket.handshake.query['tokenValue'],
        ipAddress       = socket.request.connection.remoteAddress.replace(/:/g, '');
        ipAddress       = ipAddress.replace(/f/g,'');

    socket.join(role + id);
    userConnected(role, id, null);

    //Send CSRF Token To All User Tabs
    socket.on('socket_CSRFToken_' + id + '_' + role + '_' + tokenValue, function (CSRFToken)
    {
        io.emit('socket_newBrowserTabConnected_' + id + '_' + role + '_' + tokenValue, CSRFToken);
    });

    // Listen and Emit New User Login Through Ajax
    socket.on('socket_userChanged_' + id + '_' + role + '_' + tokenValue, function (dashboardLink)
    {
        userDisconnected(role, id);
        io.emit('socket_reloadPage_'+id+'_'+role+'_'+ tokenValue, dashboardLink);
    });

    // Ping Event To Check Session Expiry
    socket.on('socket_ping_' + id + '_' + role + '_' + tokenValue, function ()
    {
        var artisanPath     = __dirname + (isWin ? '\\' : '/') + 'artisan',
            artisanCommand  = 'php ' + artisanPath + ' ftx:check-session-status --role='+ role + ' --id=' + id + ' --tokenValue=' + '"' + tokenValue + '"';

        cmd.get(artisanCommand, function(err, data, stderr)
        {
            if(err)
            {
                console.log(err);
            }
        });
    });

    // On stay_log_in Event for admin & client Broadcast To Browser
    socket.on('socket_stayLogin_' + id + '_' + role + '_' + tokenValue, function ()
    {
        var loginTime = convertDate(new Date());
        userConnected(role, id, loginTime);
        io.emit('socket_stayLogin_'+id+'_'+role+'_'+ tokenValue);
    });

    // Listen And Emit Event User Logged Out
    socket.on('socket_userLoggedOut_' + id + '_' + role + '_' + tokenValue, function (ajaxLoginForm)
    {
        deleteUser(role, id);
        io.emit('socket_userLoggedOut_'+id+'_'+role+'_'+ tokenValue, ajaxLoginForm);
    });

    // Listen And Emit Event Ajax Login Success Full
    socket.on('socket_ajaxLoginSuccess_' + id + '_' + role + '_' + tokenValue, function (newCSRFToken)
    {
        var loginTime = convertDate(new Date());
        userConnected(role, id, loginTime);
        io.emit('socket_newBrowserTabConnected_' + id + '_' + role + '_' + tokenValue, newCSRFToken);
    });

    // On Disconnect Event Socket IO
    socket.on('disconnect', function ()
    {
        userDisconnected(role, id);
    });

    /**
     * User Connected Function
     *
     * @param role
     * @param id
     * @param LogInTime
     */
    function userConnected(role, id, LogInTime)
    {
        var userData = readFromJSONFile();

        if(userData == null)
        {
            let activeUserData = setArrayWithData(role, id, null, LogInTime);

            writeToJSONFile(activeUserData);
        }
        else if(userData)
        {
            let activeUserData = setArrayWithData(role, id, userData, LogInTime);

            writeToJSONFile(activeUserData);
        }
        else
        {
            let activeUserData = setArrayWithData(role, id, null, LogInTime);

            writeToJSONFile(activeUserData);
        }
    }

    /**
     * User Disconnected Function
     *
     * @param role
     * @param id
     */
    function userDisconnected(role, id)
    {
        if(!io.sockets.adapter.rooms[role+id])
        {
            deleteUser(role, id);
        }
    }

    /**
     * Delete User From JSON file
     *
     * @param role
     * @param id
     */
    function deleteUser(role, id)
    {
        var parsedData = readFromJSONFile();

        if(parsedData != null)
        {
            if(parsedData[role+id])
            {
                delete parsedData[role+id];

                writeToJSONFile(parsedData);
            }
        }
    }

    /**
     * Set user data to array
     *
     * @param role
     * @param id
     * @param parsedData
     * @param LogInTime
     * @returns {{}}
     */
    function setArrayWithData(role, id, parsedData, LogInTime)
    {
        let activeUserData  = {};

        if(parsedData != null)
        {
            activeUserData = parsedData;

            if(!activeUserData[role+id])
            {
                activeUserData[role+id] = {};
            }
        }
        else
        {
            activeUserData[role+id] = {};
        }

        activeUserData[role+id][role+'_id']     = id;
        activeUserData[role+id]['account_id']   = socket.handshake.query['account_id'];
        activeUserData[role+id]['activity']     = (LogInTime != null) ? LogInTime : handshakeTime;
        activeUserData[role+id]['user_agent']   = userAgent;
        activeUserData[role+id]['ip_address']   = ipAddress;

        return activeUserData;
    }
});

/**
 * Read Data From JSON File Function
 *
 * @returns {*}
 */
function readFromJSONFile()
{
    var parsedData = null;

    if(fs.existsSync(__dirname + '/active-users.json'))
    {
        var JSONData = fs.readFileSync(__dirname + '/active-users.json', 'utf8');
        try
        {
            parsedData  = JSON.parse(JSONData);
        }
        catch (e)
        {
            parsedData = null;
        }
    }

    return parsedData;
}

/**
 * Write Data To JSON File
 *
 * @param parsedData
 */
function writeToJSONFile(parsedData)
{
    fs.writeFile(__dirname + '/active-users.json', JSON.stringify(parsedData, null, 4), 'utf8', (error) =>
    {
        if (error) {throw error;}
    });
}

/**
 * Convert date-time string to date() format
 *
 * @param str
 * @returns {string}
 */
function convertDate(str)
{
    let month, day, year, hours, minutes, seconds;
    let date = new Date(str);

    month   = ("0" + (date.getMonth() + 1)).slice(-2);
    day     = ("0" + date.getDate()).slice(-2);
    hours   = ("0" + date.getHours()).slice(-2);
    minutes = ("0" + date.getMinutes()).slice(-2);
    seconds = ("0" + date.getSeconds()).slice(-2);

    let mySQLDate = [date.getFullYear(), month, day].join("-");
    let mySQLTime = [hours, minutes, seconds].join(":");

    return [mySQLDate, mySQLTime].join(" ");
}

/**
 * On Message Event
 *
 */
redis.on('message', function(channel, message)
{
    var messageData = JSON.parse(message),
        type        = messageData.data['type'],
        role        = messageData.data['role'],
        id          = messageData.data['id'];

    if(type && type !== '')
    {
        switch (type)
        {
            case 'logout':

                io.emit('socket_showLogoutTimerModal_' + id + '_' + role +'_' + messageData.data['tokenValue']);
                break;

            case 'forceLogout':
                setTimeout(function ()
                {
                    io.emit('socket_forceLogout_' + id + '_' + role +'_' + messageData.data['tokenValue']);
                }, 300);
                break;

            case 'toastr':

                var data = {
                    'type'      : type,
                    'title'     : messageData.data['title'],
                    'body'      : messageData.data['body'],
                    'options'   : messageData.data['options']
                };

                setTimeout(function ()
                {
                    io.emit('socket_redisBroadcast_' + id + '_' + role,  JSON.stringify(data));
                }, 3000);
                break;

            case 'update-token':

                io.emit('socket_newBrowserTabConnected_' + id + '_' + role + '_' + messageData.data['tokenValue'], messageData.data['newTokenOrDashboardLink']);
                break;

            case 'reload-page':

                setTimeout(function ()
                {
                    io.emit('socket_reloadPage_'+id+'_'+role+'_'+ messageData.data['tokenValue'], messageData.data['newTokenOrDashboardLink']);
                }, 3000);
                break;
        }
    }
});
