#!/usr/bin/env python
#
"""
Utility functions

Some miscelaneous functions you might find helpful.
No dependencies.

bmh October 2012
"""

# Libraries
import hashlib
import datetime
import time
import os
from random import random

SIMPLE_TYPES = (int, long, float, bool, dict, basestring, list)


def to_dict(model):
    output = {}

    for key, prop in model.properties().iteritems():
        value = getattr(model, key)

        if value is None or isinstance(value, SIMPLE_TYPES):
            output[key] = value
        elif isinstance(value, datetime.date):
            # Convert date/datetime to ms-since-epoch ("new Date()").
            ms = time.mktime(value.utctimetuple())
            ms += getattr(value, 'microseconds', 0) / 1000
            output[key] = int(ms)
        elif isinstance(value, db.GeoPt):
            output[key] = {'lat': value.lat, 'lon': value.lon}
        elif isinstance(value, db.Model):
            output[key] = to_dict(value)
        else:
            raise ValueError('cannot encode ' + repr(prop))

    return output


def hash_participant_id(pid):
    salt = 'QuoMuUpP62'
    return hashlib.sha256(pid + salt).hexdigest()


def is_localhost():
    """Is running on the development SDK, i.e. NOT deployed to app engine."""
    return os.environ['SERVER_SOFTWARE'].startswith('Development')


class Keys():

    def __random_string(self):
        return self.__hash(random())

    def __hash(self, obj):
        h = hashlib.md5()
        h.update(str(obj))
        return h.hexdigest()[1:10]

    def get_private(self):
        return self.__random_string()

    def get_public(self, private):
        return self.__hash(private)

    def get_pair(self):
        private = self.get_private()
        public = self.get_public(private)
        return {'private_keys': [private], 'public_keys':[public]}


def strict_escape(string):
    allowed = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_'
    return ''.join([c for c in list(string) if c in allowed])
