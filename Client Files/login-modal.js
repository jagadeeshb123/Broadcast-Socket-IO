/**
 * Login Modal
 *
 * @param {FTXSocket} socket
 * @constructor
 */
function FTXLoginModal(socket)
{
    this.loginModal     = null;
    this.socket         = socket;
}

/**
 * Generate Login Modal
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 */
FTXLoginModal.prototype.getLoginModal = function(id, role, tokenValue)
{
    var context = this;

    if(context.loginModal === null)
    {
        context.loginModal = new ModalBox({
            modalClass      : 'modal-md',
            modalTitle      : 'LOGIN CREDENTIALS',
            modalTitleClass : 'modal-title pt-sm text-center',
            modalId         : 'loginModal',
            showTabIndex    : false,
            backdrop        : 'static',
            showCloseButton : false,
            modalFooter     : {
                show        : true,
                buttons     : [
                    {
                        text: 'Log In',
                        className: 'form-group has-feedback btn btn-sm btn-success btn-block',
                        callback: function()
                        {
                            context.loginAJAX(id, role, tokenValue);
                        }
                    }
                ]
            }
        });
    }

    context.loginModal.setBodyContents(new DomUtils().createElementArray('div', {
        classList   : 'block',
        children    : [
            {
                tag         : 'div',
                id          : 'ajaxLoginAlert',
                classList   : 'form-group has-feedback alert alert-danger text-center',
                children    : [
                    '<i class="far fa-exclamation-circle pull-left text-md-lg"></i>',
                    'Your session expired, please login again.'
                ]
            },
            {
                tag         : 'div',
                classList   : 'form-group has-feedback',
                children    : [
                    {
                        tag             : 'input',
                        id              : 'ajaxLoginEmail',
                        name            : 'ajaxLoginEmail',
                        placeholder     : role === 'user' ? 'Email/Username' : 'Employee #',
                        classList       : 'form-control',
                        required        : 'required',
                        autoComplete    : 'off',
                        autoFocus       : 'autofocus',
                        value           : '',
                        type            : 'text'
                    },
                    {
                        tag         : 'span',
                        classList   : 'fas fa-envelope form-control-feedback text-muted padding-all-10'
                    }
                ]
            },
            {
                tag         : 'div',
                classList   : 'form-group has-feedback',
                children    : [
                    {
                        tag             : 'input',
                        id              : 'ajaxLoginPassword',
                        name            : 'ajaxLoginPassword',
                        placeholder     : 'Your password',
                        classList       : 'form-control',
                        required        : 'required',
                        autoComplete    : 'off',
                        value           : '',
                        type            : 'password',
                        onkeydown       : function(event)
                        {
                            if(event.keyCode === 13)
                            {
                                context.loginAJAX(id, role, tokenValue);
                            }
                        }
                    },
                    {
                        tag         : 'span',
                        classList   : 'fas fa-envelope form-control-feedback text-muted padding-all-10'
                    }
                ]
            },
            {
                tag     : 'input',
                id      : 'ajax',
                name    : 'ajax',
                type    : 'hidden',
                value   : '1'
            }
        ]
    }));
};

/**
 * Extend User Session
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 */
FTXLoginModal.prototype.keepUserLoggedIn = function (id, role, tokenValue)
{
    var context = this;

    if(this.socket.logoutModal.logoutTimerModal)
    {
        this.socket.logoutModal.logoutTimerModal.close();
    }

    if(window.socketFTX && window.socketFTX.canShowModal)
    {
        window.socketFTX.canShowModal = true;
    }

    var route = '/ajax/keep-user-logged-in';

    View.runRequest(route, 'POST', '', true, function(response, responseText)
    {
        if(responseText && responseText.status === true && responseText.message === 'sessionExtended')
        {
            clearInterval(context.socket.logoutModal.secondsTimer);
            context.socket.socket.emit('socket_stayLogin_' + id + '_' + role + '_' + tokenValue);
        }
        else
        {
            swal('Error!!', 'Unable to extend session.', 'error');
        }
    });
};

/**
 * Login User With AJAX
 *
 * @param {Number} id
 * @param {String} role
 * @param {String} tokenValue
 */
FTXLoginModal.prototype.loginAJAX = function (id, role, tokenValue)
{
    var context         = this,
        ajaxLoginAlert  = document.getElementById('ajaxLoginAlert'),
        email           = document.getElementById('ajaxLoginEmail'),
        password        = document.getElementById('ajaxLoginPassword');

    ajaxLoginAlert.classList.add("hide");

    if(email.value && password.value)
    {
        var route   = '/login.ajax',
            params  = {
                email       : email.value,
                password    : password.value,
                ajax        : document.getElementById('ajax').value
            };

        View.runRequest(route, 'POST', params, true, function(response, responseText)
        {
            if(responseText && responseText.status === true)
            {
                if(context.loginModal)
                {
                    context.loginModal.close();
                }

                if(responseText.id === id && responseText.role === role)
                {
                    context.socket.socket.emit('socket_ajaxLoginSuccess_' + id + '_' + role + '_' + tokenValue, responseText.token);
                    toastr['success']('Successfully logged in!');

                    if(window.socketFTX && window.socketFTX.canShowModal)
                    {
                        window.socketFTX.canShowModal = true;
                    }
                }
                else
                {
                    context.socket.socket.emit('socket_userChanged_' + id + '_' + role + '_' + tokenValue, responseText.dashboardLink);
                }
            }
            else if(responseText && responseText.status === false)
            {
                ajaxLoginAlert.innerHTML = '<i class="far fa-exclamation-circle pull-left text-md-lg"></i> These credentials do not match our records.';
                ajaxLoginAlert.classList.remove('hide');
            }
            else
            {
                if(context.loginModal)
                {
                    context.loginModal.close();
                }

                if(window.socketFTX && window.socketFTX.canShowModal)
                {
                    window.socketFTX.canShowModal = true;
                }

                swal('Error!!', 'Unable to Login', 'error');
            }
        });
    }
    else
    {
        ajaxLoginAlert.innerHTML = '<i class="far fa-exclamation-circle pull-left text-md-lg"></i> Both fields are required.';
        ajaxLoginAlert.classList.remove("hide");
    }
};

export default FTXLoginModal;