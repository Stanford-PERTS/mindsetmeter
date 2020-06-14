// mindsetMeter.js
//
// Globally accessible functions for the mindset meter available as
// mindsetMeter.functionName or under the alias mm.functionName
//
// Depends on jquery and serializeObject
//
// bmh Nov 2012

/* global JSON, console */

var mm;             // alias for mindsetMeter
var mindsetMeter;   // the true namespace


mindsetMeter = (function () {
  "use strict";   // tight-ass javascript.
                  // See http://stackoverflow.com/questions/1335851/what-does-use-strict-do-in-javascript-and-what-is-the-reasoning-behind-it

  // PUBLIC
  // Anything that clients can use should be a member of pub.
  // All other data and functions will be private by default.
  var pub = {};

  // Prevents the browser from caching the server's responses to AJAX calls.
  // Important for calls to reset_keys to actually work (rather than the last
  // reset request being cached and the keys NOT being reset).
  $.ajaxSetup({cache: false});


  // CONSTANTS
  // Look for any change in the input
  pub.any_change = "propertychange keyup paste change";

  // UTILITY FUNCTIONS
  var serialize = function (jquerySelector) {
    // Serialize form content into a dictionary
    // i.e. {name:(value | [value1, value2, ...])}
    return $(jquerySelector).serializeObject();
  };

  var get_root = function () {
    // Get the base domain port and protocols in order to make stable urls
    return location.protocol + '//' + location.hostname +
      (location.port ? ':' + location.port : '');
  };


  var url_lookup = function (name) {
    // Get parameter values from url
    // retrieves an array to support multiple matches
    // based on stackoverflow.com/questions/1403888/get-url-parameter-with-jquery

    var
      searchString = window.location.search.substring(1),
      i, val, params = searchString.split("&"),
      result = [];

    for (i=0; i<params.length; i += 1) {
      val = params[i].split("=");
      if (val[0] === name) {
        result.push(val[1]);
      }
    }

    return result;
  };

  var get_keys_from_url = function () {
    // Get the domain, protocol, and port
    // So that requests can be made irrespecitve of nesting
    var keys = {
      'private_keys': url_lookup('private_key'),
      'public_keys': url_lookup('public_key')
    };
    return keys;
  };


  // KEY FUNCTIONS
  //
  // These functions return keys associted with a
  // user for a given survey.
  //
  // About keys:
  // Public keys are used to save results and private keys
  // are used to retrieve results.  Users must have a keypair
  // for each survey they take.  This pair will be stored in
  // a cookie and generated if they do not already have one.
  // Also any number of additional keys passed in the url.
  // These keys are used to share results with other users.

  var get_key_cookie = function () {
    // Find the cookie, if it doesn't exist, create it
    var all_keys = JSON.parse($.cookie('keys')) ;

    if(all_keys === null || typeof all_keys !== 'object'){
      all_keys = {};
    }

    return all_keys;
  };

  var get_keys_from_cookie = function (survey) {
    var
      keys = get_key_cookie(),
      result = {};

    if (keys) {
      if (keys[survey]) {
        result = {
          'private_keys': keys[survey].private_keys,
          'public_keys': keys[survey].public_keys
        };
      }
    }

    return result;
  };

  var write_keys_to_cookie = function (survey, keys_to_append) {
    var keys = get_key_cookie();
    keys[survey] = keys_to_append;
    $.cookie('keys', JSON.stringify(keys));
  };

  var ensure_cookie_has_keys = function (survey, callback) {
    // Attempts to find existing keys from the cookie
    // if they do not exist, this function looks to the server
    // and updates the cookie with these new keys
    //
    // optional callback function is called with the keys

    var existing_keys = get_keys_from_cookie(survey);

    if (existing_keys === undefined ||
        existing_keys.public_keys === undefined ||
        existing_keys.private_keys === undefined) {
      get_keys(null, function (keys) {
        write_keys_to_cookie(survey, keys);
        if(typeof(callback) === "function"){ callback(keys);}
      });
    } else {
      if(typeof(callback) === "function"){ callback(existing_keys);}
    }
  };

  var reset_keys = function (survey, callback) {
      get_keys(null, function (keys) {
        write_keys_to_cookie(survey, keys);
        if(typeof(callback) === "function"){ callback(keys);}
      });
  };

  var get_all_local_keys = function (survey) {
    // Combine keys from cookie and url

    var
      personal = get_keys_from_cookie(survey),
      url = get_keys_from_url();

    return {
      'private_keys': personal.private_keys.concat(url.private_keys),
      'public_keys': personal.public_keys.concat(url.public_keys)
    };
  };


  var get_group = function (survey) {
    // Get the entity group that results should be saved under
    // this will be the user's private key for a given survey
    return mm.get_keys_from_cookie(survey).private_keys[0];
  };

  // API FUNCTIONS
  //
  // These functions communicate with the api,
  // which they assume is located at domain/api/function
  var post_metric = function (event, name, rubric, survey, description, callback) {
    if (event) { event.preventDefault(); }

    $.post(get_root() + '/admin/api/metric',
      {
        'name' : name,
        'rubric' : rubric,
        'survey' : survey,
        'description' : description
      },
      callback
      );
  };

  var get_metric = function (event, name, callback) {
    if (event) { event.preventDefault(); }

    $.get(get_root() + '/api/metric',
      {
        'name' : name
      },
      callback
      );
  };

  var post_result = function (event, public_keys, metric, answers, callback, group) {
    if (event) { event.preventDefault(); }
    var data = {
        'keys': JSON.stringify(public_keys),
        'metric': metric,
        'answers': JSON.stringify(answers)
      };

    // handle optional arguments
    if (group) { data.group = group; }

    $.post(get_root() + '/api/result', data, callback);
  };

  var get_result = function (event, private_keys, callback, group) {
    if (event) { event.preventDefault(); }
    var data = {
      'private_keys': JSON.stringify([].concat(private_keys))
    };

    // handle optional arguments
    if (group) { data.group = group; }

    $.get(get_root() + '/api/result',
      data,
      callback
      );
  };

  var get_keys = function (event, callback) {
    if (event) { event.preventDefault(); }

    $.get(get_root() + '/api/keys', {}, callback);
  };

  var post_email = function (event, metric, private_key, address, callback) {
    if (event) { event.preventDefault(); }

    var data = {
        'metric' : metric,
        'private_key' : private_key,
        'address' : address
    };

    $.post(get_root() + '/api/email', data, callback);
  };

  var post_feedback_email = function (event, reply_to, message, callback) {
    if (event) { event.preventDefault(); }

    var data = {
        'reply_to' : reply_to,
        'message' : message
    };

    $.post(get_root() + '/api/email_feedback', data, callback);
  };

  var post_feedback_email_wrapper = function (event) {
    post_feedback_email(
      event,
      $('#reply_to').val(),
      $('#message').val(),
      function(result) {
        if(result.ok) {
          $('#email').html('<strong>Feedback sent. Thanks!</strong>');
        }
        else {
          $('#email').html('Error');
          mm.post_error("Could not send feedback, please email " +
              " directly");
        }
      }
    );
  };

  var post_error = function (event, message, callback) {
    if (event) { event.preventDefault(); }

    var data = {
        'message' : message
    };

    $.post(get_root() + '/api/error', data, callback);
  };

  // Read query string parameters as a javascript object.
  //
  // Not tested for:
  //
  // * Mixing bracketed and non-bracketed keys
  // * Indexed brackets
  // * Nested lists
  //
  // Some examples (See unit tests below for full details):
  //
  // | query string |       result       |
  // |--------------|--------------------|
  // | undefined    | uses current URL   |
  // | ?            | {}                 |
  // | ?a           | {a: undefined}     |
  // | ?a=          | {a: undefined}     |
  // | ?a=1&b=2     | {a: 1, b: 2}       |
  // | a=1&b=2      | {a: 1, b: 2}       |
  // | ?a[]=1&b=2   | {a: [1], b: 2}     |
  // | ?a=1&a=2     | {a: [1, 2]}        |
  // | ?a[]=1&a[]=2 | {a: [1, 2]}        |
  // | ?a[]=1&a=2   | undefined behavior |
  // | ?a[1]=1      | undefined behavior |
  // | ?a[][]=1     | undefined behavior |

  var query_string_to_object = function (queryString) {
    var params = {};
    // Allow for easy invocation in the default case.
    if (queryString === undefined) {
      queryString = window.location.search;
    }
    // Leading question mark optional.
    if (queryString.charAt(0) === '?') {
      queryString = queryString.substring(1);
    }
    // Quick return for empty query string.
    if (queryString === '') {
      return params;
    }
    // Separate the query string into key-value pairs.
    // Be careful with split! ''.split('&') gets you [''], which makes no sense
    var pairStrings = queryString.indexOf('&') === -1 ?
      [queryString] : queryString.split('&');
    // Add each key-value pair to the params object.
    pairStrings.forEach(function (pairStr) {
      // Split up the key and value, decoding URL escaping.
      var pair = pairStr.split('='),
          key = decodeURIComponent(pair[0]),
          value = pair[1] ? decodeURIComponent(pair[1]) : undefined,
          // A key becomes a list if either 1) it repeats or 2) it ends in [].
          keyIsList = false;
      // Check for bracket notation.
      if (key.substr(-2) === '[]') {
        keyIsList = true;
        key = key.substr(0, key.length - 2);
      }
      // Check for repeats.
      if (key in params && !(params[key] instanceof Array)) {
        keyIsList = true;
        params[key] = [params[key]];
      }
      // Lists keys need to be pushed, not assigned.
      if (keyIsList) {
        // Never-before-seen bracketed keys need their list initialized.
        if (!(key in params)) {
          params[key] = [];
        }
        // Pushing undefined does "set" that index in the array. It's cleaner
        // to not push it if the key has no value.
        if (value !== undefined) {
          params[key].push(value);
        }
      } else {
        // Simple assignment for non-list keys.
        params[key] = value;
      }
    });
    return params;
  };

  // Query string unit tests. Returns map of test names to success true/false.
  (function (f) {
    var tests = [
      function normalNonRepeated() {
        var p = f('?foo=bar&baz=quz');
        return p.foo === 'bar' && p.baz === 'quz';
      },
      function normalNonRepeatedWithoutQuestionMark() {
        var p = f('foo=bar&baz=quz');
        return p.foo === 'bar' && p.baz === 'quz';
      },
      function empty() {
        var p = f('?');
        return p !== null && p !== undefined && p.constructor === Object;
      },
      function valuelessWithEquals() {
        var p = f('?foo=&baz=quz');
        return p.foo === undefined && p.baz === 'quz';
      },
      function valuelessWithEqualsSimple() {
        var p = f('?foo=');
        return p.foo === undefined;
      },
      function valuelessWithoutEquals() {
        var p = f('?foo&baz=quz');
        return p.foo === undefined && p.baz === 'quz';
      },
      function valuelessWithoutEqualsSimple() {
        var p = f('?foo');
        return p.foo === undefined;
      },
      function repeatedWithoutBrackets() {
        var p = f('?foo=bar1&foo=bar2&baz=quz');
        return p.foo[0] === 'bar1' && p.foo[1] === 'bar2' && p.baz === 'quz';
      },
      function repeatedWithBrackets() {
        var p = f('?foo[]=bar1&foo[]=bar2&baz=quz');
        return p.foo[0] === 'bar1' && p.foo[1] === 'bar2' && p.baz === 'quz';
      },
      function decodesUrlComponents() {
        var p = f('?%E3%81%BB%E3%81%92=%E3%81%BB%E3%81%92');
        return p['ほげ'] === 'ほげ';
      }
    ];
    var results = {};
    tests.forEach(function (testFn) {
      var success = false;
      try {
        success = testFn();
      } catch (e) {}
      results[testFn.name] = success;
      if (!success) {
        console.error("Unit test for mm.query_string_to_object() failed:",
                      testFn.name);
      }
    });
    return results;
  }(query_string_to_object));

  var mean = function (ar) {
    var i = 0, sum = 0;
    for (i = 0; i < ar.length; i += 1) {
      sum += Number(ar[i]);
    }
    return Math.round(sum / ar.length * 100) / 100;
  };

  var scaleMean = function (obj, pattern) {
    var targetsVals = [];
    for (var key in obj) {
      if (key.search(pattern) === 0) { targetsVals.push(obj[key]); }
    }
    return mean(targetsVals);
  };


  // PUBLIC FUNCTIONS
  // put functions into the public space
  pub.url_lookup = url_lookup;
  pub.get_keys = get_keys;
  pub.get_result = get_result;
  pub.post_result = post_result;
  pub.get_metric = get_metric;
  pub.post_metric = post_metric;
  pub.post_email = post_email;
  pub.post_feedback_email = post_feedback_email;
  pub.post_feedback_email_wrapper = post_feedback_email_wrapper;
  pub.post_error = post_error;
  pub.get_root = get_root;
  pub.get_all_local_keys = get_all_local_keys;
  pub.get_group = get_group;
  pub.ensure_cookie_has_keys = ensure_cookie_has_keys;
  pub.reset_keys = reset_keys;
  pub.write_keys_to_cookie = write_keys_to_cookie;
  pub.get_keys_from_cookie = get_keys_from_cookie;
  pub.get_keys_from_url = get_keys_from_url;
  pub.serialize = serialize;
  pub.query_string_to_object = query_string_to_object;
  pub.mean = mean;
  pub.scaleMean = scaleMean;

  return pub;
}());
mm = mindsetMeter;
