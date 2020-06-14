// Error Logging
// 
// Javascript errors should be posted to the server
// depends on mindsetMeter.js to find where to post to.
// copied from Andy E on SO - http://stackoverflow.com/a/2825685/431079
//

window.onerror = function (msg, url, line)
{
    var message = "Error in "+url+" on line "+line+": "+msg;
    $.post(mm.get_root() + "/api/error", { "message" : message }); 
}

