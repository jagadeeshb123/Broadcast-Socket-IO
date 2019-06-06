/**
 * Broadcast Redis Message With Toastr
 *
 * @param {Object|String} params
 * @returns {FTXBroadcastMessage}
 * @constructor
 */
function FTXBroadcastMessage(params)
{
    console.log('Broadcast:', params);
	this.params = params;
   
    return this;
}

/**
 * Show Message To User
 */
FTXBroadcastMessage.prototype.run = function()
{
    toastr.clear();

    var data = this.params;

    setTimeout(function ()
    {
        var title   = data['title'],
            body    = data['body'],
            options = data['options'];

        toastr[options['_type']](body, title, options);

    }, 2000);
};

export default FTXBroadcastMessage;