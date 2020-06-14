/* global JSON */

var util = (function () {
    'use strict';
    return {
        jsonCopy: function (obj) {
            return JSON.parse(JSON.stringify(obj));
        }
    };
}());

// * adds the ability to iterate a callback over an array
// to the core Array datatype (and overwrites whatever
// non-standard method supplied by the browser)
// * notably, it returns an array of all the values returned
// by the iterated function
Array.prototype.forEach = function (callback, thisArg) {
    /* jshint bitwise: false */  // allow bitwise operators in this scope
    var T, k, r, results = [];

    if (this === null || this === undefined) {
        throw new TypeError(' this is null or not defined');
    }

    var O = Object(this);
    // the unsigned right shift operator, will convert any type to
    // a positive integer
    var len = O.length >>> 0;
    if (typeof callback !== 'function') {
        throw new TypeError(callback + ' is not a function');
    }

    if (arguments.length > 1) {
        T = thisArg;
    }

    k = 0;
    while (k < len) {
        var kValue;
        if (k in O) {
            kValue = O[k];
            r = callback.call(T, kValue, k, O);
            if (r !== undefined) {
                results.push(r);
            }
        }
        k += 1;
    }

    return results;
};

// firefox implements an indexOf method for arrays, but IE doesn't
// this makes sure the presence of indexOf is uniform

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (element, from) {
        'use strict';
        from = Number(from) || 0;
        from = (from < 0) ? Math.ceil(from) : Math.floor(from);
        if (from < 0) {
            from += this.length;
        }
        for (from; from < this.length; from += 1) {
            if (this[from] === element) {
                return from;
            }
        }
        return -1;
    };
}

if (!Array.prototype.filter) {
    Array.prototype.filter = function(fun, thisp) {
        'use strict';

        if (!this) {
            throw new TypeError();
        }

        var objects = Object(this);
        if (typeof fun !== 'function') {
            throw new TypeError();
        }

        var res = [], i;
        for (i in objects) {
            if (objects.hasOwnProperty(i)) {
                if (fun.call(thisp, objects[i], i, objects)) {
                    res.push(objects[i]);
                }
            }
        }

        return res;
    };
}

if ('function' !== typeof Array.prototype.reduce) {
    Array.prototype.reduce = function(callback, opt_initialValue){
        'use strict';
        if (null === this || 'undefined' === typeof this) {
            // At the moment all modern browsers, that support strict mode, have
            // native implementation of Array.prototype.reduce. For instance, IE8
            // does not support strict mode, so this check is actually useless.
            throw new TypeError(
                'Array.prototype.reduce called on null or undefined');
        }
        if ('function' !== typeof callback) {
            throw new TypeError(callback + ' is not a function');
        }
        var index, value,
            length = this.length >>> 0,
            isValueSet = false;
        if (1 < arguments.length) {
            value = opt_initialValue;
            isValueSet = true;
        }
        for (index = 0; length > index; ++index) {
            if (this.hasOwnProperty(index)) {
                if (isValueSet) {
                    value = callback(value, this[index], index, this);
                }
                else {
                    value = this[index];
                    isValueSet = true;
                }
            }
        }
        if (!isValueSet) {
            throw new TypeError('Reduce of empty array with no initial value');
        }
        return value;
    };
}

// Hilariously, splice is broken in IE. Fix it.
// http://stackoverflow.com/questions/8332969/ie-8-slice-not-working
(function () {
    'use strict';
    var originalSplice = Array.prototype.splice;
    Array.prototype.splice = function (start, deleteCount) {
        // convert the weird, not-really-an-array arguments array to a real one
        var args = Array.prototype.slice.call(arguments);
        // IE requires deleteCount; set default value if it doesn't exist
        if (deleteCount === undefined) {
            args[1] = this.length - start;
        }
        // call the original function with the patched arguments
        return originalSplice.apply(this, args);
    };
}());

// Not implemented in IE. Just like sanity isn't implemented in IE.
if (!Date.prototype.toISOString) {
    (function () {
        'use strict';
        var pad = function pad(number) {
            var r = String(number);
            if (r.length === 1) {
                r = '0' + r;
            }
            return r;
        };
        Date.prototype.toISOString = function() {
            return this.getUTCFullYear() +
                '-' + pad(this.getUTCMonth() + 1) +
                '-' + pad(this.getUTCDate()) +
                'T' + pad(this.getUTCHours()) +
                ':' + pad(this.getUTCMinutes()) +
                ':' + pad(this.getUTCSeconds()) +
                '.' + String((this.getUTCMilliseconds() / 1000).toFixed(3)).slice(2, 5) +
                'Z';
        };
    }());
}

if (!Function.prototype.bind) {
    Function.prototype.bind = (function (slice) {
        'use strict';
        // (C) WebReflection - Mit Style License
        var bind = function (context) {

            var self = this; // "trapped" function reference

            // only if there is more than an argument
            // we are interested into more complex operations
            // this will speed up common bind creation
            // avoiding useless slices over arguments
            if (1 < arguments.length) {
                // extra arguments to send by default
                var $arguments = slice.call(arguments, 1);
                return function () {
                    return self.apply(
                        context,
                        // thanks @kangax for this suggestion
                        arguments.length ?
                                // concat arguments with those received
                                $arguments.concat(slice.call(arguments)) :
                                // send just arguments, no concat, no slice
                                $arguments
                    );
                };
            }
            // optimized callback
            return function () {
                // speed up when function is called without arguments
                return arguments.length ? self.apply(context, arguments) : self.call(context);
            };
        };

        // the named function
        return bind;

    }(Array.prototype.slice));
}

// ** IE compatibility ** //

// IE doesn't always have console.log, and, like the piece of fossilized
// dinosaur dung that it is, will break when it encounters one. So put in a
// dummy.
if (!window.console) {
    window.console = {
        error: function (msg) {
            'use strict';
            alert('console.error(): ' + JSON.stringify(msg));
        },
        warn: function (msg) {
            'use strict';
            alert('console.warn(): ' + JSON.stringify(msg));
        },
        log: function () {},
        debug: function () {}
    };
} else if (!console.debug) {
    // in ie 10, console exists, but console.debug doesn't!!
    console.debug = function () {};
}

function printObject(o) {
    var out = [];
    for (p in o) {
        if (o.hasOwnProperty(p)) {
            var type;
            if (typeof o[p] === 'boolean') {
                type = 'boolean ' + (o[p] ? 'true' : 'false');
            } else if (typeof o[p] === 'object') {
                if (o[p] === null) {
                    type = 'null';
                } else if (o[p] instanceof Array) {
                    type = 'array'
                } else {
                    type = 'object';
                }
            } else if (typeof o[p] === 'number') {
                type = isNaN(o[p]) ? 'NaN' : 'number';
            } else {
                type = typeof o[p];
            }
            out.push(p + ": [" + type + "] " + o[p]);
        }
    }
    return out.join("\n");
}
