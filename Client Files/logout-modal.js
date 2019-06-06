import FTXLoginModal from "./login-modal";

/**
 * Logout Modal
 *
 * @param {FTXSocket} socket
 * @constructor
 */
function FTXLogoutModal(socket)
{
    this.logoutTimerModal   = null;
    this.secondsTimer       = null;
    this.socket             = socket;
}

/**
 * Generate Logout Modal
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 */
FTXLogoutModal.prototype.getLogoutModal = function (id, role, tokenValue)
{
    var context = this;

    if(!this.logoutTimerModal)
    {
        this.logoutTimerModal = new ModalBox({
            modalClass      : 'modal-md',
            modalTitle      : 'Session Time Out',
            modalTitleClass : 'modal-title pt-sm text-center',
            modalId         : 'logoutTimerModal',
            showTabIndex    : false,
            backdrop        : 'static',
            showCloseButton : false,
            modalFooter     : {
                show        : true,
                buttons     : [
                    {
                        text        : 'Stay Logged In',
                        className   : 'btn btn-sm btn-success',
                        callback    : function()
                        {
                            context.socket.loginModal.keepUserLoggedIn(id, role, tokenValue);
                        }
                    }
                ]
            },
            onShown: function()
            {
                context.startCountdownTimer(id, role, tokenValue, 60);
            }
        });
    }

    this.logoutTimerModal.setBodyContents('<div class="text-center">Your session is about to expire in <span style="color:blue" id="countdownTimer">60</span> seconds. Click below to stay Logged in.</div>');
};

/**
 * Start Seconds Countdown
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 * @param {Number} seconds
 */
FTXLogoutModal.prototype.startCountdownTimer = function (id, role, tokenValue, seconds)
{
    var context = this;

    this.secondsTimer = setInterval(function()
    {
        seconds = seconds - 1;

        document.getElementById('countdownTimer').innerHTML = seconds.toString();

        if(seconds === 0)
        {
            context.socket.logoutModal.logOutUser(id, role, tokenValue);
        }
    }, 1000);
};

/**
 * Logout User
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 */
FTXLogoutModal.prototype.logOutUser = function(id, role, tokenValue)
{
    var context = this;

    if(this.logoutTimerModal)
    {
        this.logoutTimerModal.close();
    }

    if(this.secondsTimer)
    {
        clearInterval(this.secondsTimer);
    }

    if(window.socketFTX && window.socketFTX.canShowModal)
    {
        window.socketFTX.canShowModal = true;
    }

    var route   = '/logout',
        params  = {
            ajax: true
        };

    if(!context.socket.loginModal.loginModal)
    {
        View.runRequest(route, 'GET', params, true, function()
        {
            context.socket.socket.emit('socket_userLoggedOut_' + id + '_' + role + '_' + tokenValue);
        });
    }
};

export default FTXLogoutModal;