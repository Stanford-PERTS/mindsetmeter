#!/usr/bin/env python
#
"""
Mindset Meter

The mindset meter will test a users psychometrics and report
their results.  These results will also be shared with the
person who invited them to answer the survey.

This file will serve as a prototype of the web based mindsetmeter
meter and develop its api.

bmh October 2012
"""

# LIBRARIES
#

# web app
import webapp2
from google.appengine.api import users     # log in users with open id
from google.appengine.ext import db        # database
from google.appengine.api import mail      # email

# templating
import jinja2

# mine
import util                                # helper functions without dependencies

# python
import json                                # to output api data
import logging                             # log to appengine log
from contextlib import closing             # usefule for csv
import cStringIO                           # ''
from zipfile import ZipFile, ZIP_DEFLATED  # ''
import csv
import config                              #
import os

import mandrill

# Load helper classes
jinja_environment = jinja2.Environment(
    autoescape=True,
    loader=jinja2.FileSystemLoader('templates')
)


# Data Structures
class Model(db.Model):
    created = db.DateTimeProperty(auto_now_add=True)


class Metric(Model):
    """A survey and rubric"""
    name = db.StringProperty(required=True)

    @classmethod
    def get_by_name(self, name):
        if name in config.metrics:
            self.name = name
        else:
            raise Exception("{} is not a registered metric.".format(name))
        return self


class Group(Model):
    """Parents of answers used to guarantee consistency for a user"""
    id = db.StringProperty(required=True)

    @classmethod
    def get_group(self, group):
        result = Group.gql(""" WHERE id = :1 ORDER BY created DESC""", group).get()
        if not result:
            logging.warning('No matching group')
        return result

    @classmethod
    def put_group(self, group):
        return Group(id=group).put()


class Result(Model):
    """Answers to a survey and access permissions"""
    keys = db.StringListProperty(required=True)
    metric = db.StringProperty(required=True)
    answers_json = db.TextProperty(default='')  # preferred

    @classmethod
    def get_results(self, private_keys, group=None):
        public_keys = [util.Keys().get_public(k) for k in private_keys]
        ancestor = Group.get_group(group)

        if ancestor:
            results = Result.gql(""" WHERE keys IN :1
                                     AND ANCESTOR IS :2
                                     ORDER BY created DESC""", public_keys, ancestor)
        else:
            results = Result.gql(""" WHERE keys IN :1
                                     ORDER BY created DESC""", public_keys)

        metrics = set()
        answers = []
        for r in results:
            metrics.add(r.metric)
            answers.append(r.get_answers())

        if len(metrics) > 1:
            raise Exception("Keys were not all from the same metric: {} {}"
                            .format(public_keys, metrics))

        if len(answers) > 0:
            return {'metric': metrics.pop(), 'answers': answers}
        else:
            # No results
            logging.info('No answers found')
            return {'metric': 'no responses yet',
                    'answers': []}

    @classmethod
    def put_result(self, keys, metric, answers, group):
        if group:
            parent = Group.get_group(group)
            result = Result(keys=keys, metric=metric, answers_json=answers,
                            parent=parent)
        else:
            result = Result(keys=keys, metric=metric, answers_json=answers)

        return result.put()

    def get_answers(self):
        # Some old entities don't have json-based results. Treat them as if
        # they are empty. This is easier than deleting them all.
        if self.answers_json:
            answers = json.loads(self.answers_json)
        else:
            answers = {}

        # Always take the precaution of hashing participant ids, if present.
        if 'pid' in answers:
            answers['pid'] = util.hash_participant_id(answers['pid'])

        return answers


# Page Handlers and APIs
class Handler(webapp2.RequestHandler):
    def write(self, *a, **kw):
        self.response.write(*a, **kw)

    def render_str(self, template, **params):
        return jinja_environment.get_template(template).render(**params)

    def render(self, template, **kw):
        self.write(self.render_str(template, **kw))

    def write_json(self, obj):
        self.response.headers['Content-Type'] = "text/json; charset=utf-8"
        self.write(json.dumps(obj))


class MainHandler(Handler):
    def get(self):
        self.render('index.html')


class TakeHandler(Handler):
    def get(self, name):
        metric = Metric.get_by_name(name)
        if metric:
            self.render(name + '_survey.html', name=name)
        else:
            logging.error('Could not find requested metric')
            self.render('404.html')


class CompleteHandler(Handler):
    def get(self, name):
        key = self.request.get('private_key', None)
        group = self.request.get('group', None)
        answers = []

        if key is None:
            # If there's no key, then this is a preview. Don't try to load any
            # answers.
            logging.info("No key present; rendering preview.")
        else:
            try:
                answers = Result.get_results([key], group)['answers']
            except Exception as e:
                # There was some problem with the keys that were given. Just
                # display the report with no answers.
                logging.error('Problem with private key: {}'.format(e))

        try:
            metric = Metric.get_by_name(name)
        except Exception as e:
            logging.error('Could not find requested metric: {}'.format(e))
            self.render('404.html')
            return

        # Render without html escaping
        self.render(metric.name + '_survey_complete.html',
                    group=group, answers=jinja2.Markup(json.dumps(answers)))


class SampleHandler(Handler):
    def get(self, name):
        metric = Metric.get_by_name(name)
        if metric:
            sample_template = name + '_sample_results.html'
            # If there's a sample report, render that.
            if os.path.isfile('templates/' + sample_template):
                self.render(name + '_sample_results.html', name=name)
            # Some reports can render themselves as a sample if no data is
            # provided. These don't have a separate sample template. Instead,
            # just serve up the main report template.
            else:
                self.render(name + '_results.html', name=name)
        else:
            logging.error('Could not find requested metric')
            self.render('404.html')


class ResultsHandler(Handler):
    def get(self, metric=None, keys_str=''):
        # Multiple keys can be specified, separated by hyphens, in which case
        # multiple sets of results should be sent to the template.
        keys = keys_str.split('-')
        # A group may be applicable here for single-keyed results.
        group = self.request.get('group') if len(keys) is 1 else None

        try:
            results = Result.get_results(keys, group)
        except Exception as e:
            # There was some problem with the keys that were given.
            logging.error('{}'.format(e))
            self.render('404.html')
            return

        template = None
        answers = []

        if metric:
            # A specific metric was requested. Check that 1) it exists and 2)
            # it matches the answers, if any. Then show that metric's results
            # page.
            if metric not in config.metrics:
                logging.error("Unknown metric: {}".format(metric))
                template = '404.html'
            if len(results['answers']) > 0:
                if metric != results['metric']:
                    logging.error("Key is from metric {}, but {} requested."
                                  .format(results['metric'], metric))
                    template = '404.html'
                answers = results['answers']

            # If the template hasn't been set by an error check above, give the
            # metric-specific results page.
            template = template or metric + '_results.html'
        else:
            # No specific metric was given. Infer it from the answers, if any,
            # otherwise show a generic no-results page.
            if len(results['answers']) > 0:
                metric = results['metric']
                answers = results['answers']
                template = metric + '_results.html'
            else:
                template = 'no_responses.html'

        # Render without html escaping.
        answers = jinja2.Markup(json.dumps(answers))
        self.render(template, group=group, answers=answers)


class ShareHandler(Handler):
    def get(self, name):
        keypair = util.Keys().get_pair()
        # Render without html escaping
        metric = Metric.get_by_name(name)
        self.render(
            metric.name + '_share.html', name=name,
            private_key=keypair['private_keys'][0],
            public_key=keypair['public_keys'][0])


class CsvHandler(Handler):
    """Return a csv based on the json array passed in
    for example the following is a valid request (exploded for clarity)
    /csv?
        filename=gotcha&
        headers=["name","age"]&
        data=[["jack",12],["john",42],["joe",68]]
    """
    def get(self):
        # Get input
        data = self.request.get('data')
        headers = self.request.get('headers')
        filename = self.request.get('filename').encode('ascii', 'ignore')

        # Convert to json
        data = json.loads(data)
        if headers:
            headers = json.loads(headers)

        # Check input
        if not headers:
            logging.warning('no headers sent')
        if not type(headers) == 'list':
            logging.warning('the headers are not a list')
        if not data:
            logging.warning('no data')
        if not type(data) == 'list':
            logging.warning('data is not a list')
        if not len(data) > 0:
            logging.warning('data has not length')
        if not all([type(row) == 'list' for row in data]):
            logging.warning('data contains members which are not lists')

        # Set up headers for browser to correctly recognize the file
        self.response.headers['Content-Type'] = 'text/csv'
        self.response.headers['Content-Disposition'] = 'attachment; filename="' + filename + '.csv"'

        # write the csv to a file like string
        csv_file = cStringIO.StringIO()
        csv_writer = csv.writer(csv_file)

        # add headers if sent
        if headers:
            csv_writer.writerow(headers)

        # add data
        for row in data:
            csv_writer.writerow(row)

        # Emit the files directly to HTTP response stream
        self.response.out.write(csv_file.getvalue())


class AdminCreateHandler(Handler):
    def get(self):
        self.render('create.html')


class MetricApi(Handler):

    default_rubric = """<script>
  pretty_answers = JSON.stringify(mm.answers, null, 4)
  $('#responses').html(pretty_answers);
</script>
<pre id='responses'></pre>
"""

    default_survey = """<input name="quest"/>"""

    def get(self):
        name = self.request.get('name')
        if name:
            metric = Metric.get_by_name(name)
            if metric:
                self.write_json(util.to_dict(metric))
            else:
                default_description = "<h3>" + name + "</h3>"
                self.write_json({
                    'survey': self.default_survey,
                    'rubric': self.default_rubric,
                    'description': default_description
                })
        else:
            logging.error('Metric request had no name')
            self.write_json({'error': 'a name is required'})


class AdminMetricApi(Handler):
    def post(self):
        name = self.request.get('name')
        survey = self.request.get('survey')
        rubric = self.request.get('rubric')
        description = self.request.get('description')

        if name and survey and rubric:
            Metric(
                name=name, survey=survey,
                rubric=rubric, description=description).put()
            self.write_json({'ok': True})
        else:
            logging.error('Posted metric was missing name, survey, description, or rubric')
            message = "a name, survey, description, and grading rubric are required"
            self.write_json({'error': message})


class AdminDataHandler(Handler):
    """Return a csv of all responses"""
    def get(self):

        # Set up headers for browser to correctly recognize the file
        self.response.headers['Content-Type'] = 'text/csv'
        self.response.headers['Content-Disposition'] = 'attachment; filename="mm_data.csv"'

        # write the csv to a file like string
        csv_file = cStringIO.StringIO()
        csv_writer = csv.writer(csv_file)
        headers = ['created', 'metric', 'question', 'answer']
        csv_writer.writerow(headers)
        for result in Result.all():
            for k, v in result.get_answers().items():
                row = [result.created, result.metric, k, v]
                csv_writer.writerow(row)

        # Emit the files directly to HTTP response stream
        self.response.out.write(csv_file.getvalue())

        logging.info('All data downloaded by admin')
        logging.info(csv_file.getvalue())


class ResultApi(Handler):

    def get(self):
        private_keys = json.loads(self.request.get('private_keys'))
        group = self.request.get('group')

        if private_keys:
            for k in private_keys:
                k.encode('ascii')
            try:
                response = Result.get_results(private_keys, group)
            except Exception as e:
                logging.error('{}'.format(e))
                response = "Problem with provided keys. {}".format(e)
        else:
            logging.error('Requested result without a private key')
            response = "a private key is required"

        self.write_json(response)

    def post(self):
        keys = json.loads(self.request.get('keys'))
        metric = self.request.get('metric')
        group = self.request.get('group')
        answers = self.request.get('answers')
        json.loads(answers)  # validity check

        if keys and metric and answers:
            logging.info("Saving result {} {} {} {}".format(keys, metric, answers, group))
            Result.put_result(keys, metric, answers, group)
            self.write_json({'ok': True})
        else:
            logging.error('Posted result without a metric, keys, or answers')
            message = "a metric, keys, and answers are required"
            self.write_json({'error': message})


class KeysApi(Handler):
    """Hand out public and private keys"""
    def get(self):
        keypair = util.Keys().get_pair()
        Group.put_group(keypair['private_keys'][0])
        self.write_json(keypair)


class ErrorApi(Handler):
    """Log javascript errors for debuggind purposes"""
    def post(self):
        logging.error('Javascript Error: ' + self.request.get('message'))


class EmailApi(Handler):
    """Send a user an email with their keys"""
    def post(self):
        address = self.request.get('address')
        private_key = self.request.get('private_key')
        metric = self.request.get('metric')

        if address and private_key and metric:
            private_key.encode('ascii')         # handle unicode properly
            public_key = util.Keys().get_public(private_key)
            root = "http://survey.perts.net"
            take_link = root + '/take/' + metric + '?public_key=' + public_key
            results_link = root + '/results/' + private_key
            message = self.render_str(
                'email.html', address=address, take_link=take_link,
                results_link=results_link, metric=metric)

            result = mandrill.send(
                to_address=address,
                subject="Mindset Meter Study Links",
                body=message,
            )
            if result:
                logging.info(
                    'Email sent to ' + address + ' with the message ' + message
                )
            self.write_json({'ok': True})

        else:
            message = "address, private_key, and metric are necessary to email a user"
            logging.error(message)
            self.write_json({'error': message})


class EmailFeedback(Handler):
    """Allow users to send feedback on the mindset meter.

    This should be as simple as possible to maximize feedback.
    """
    def post(self):
        # Reply to is optional
        reply_to = self.request.get('reply_to')
        logging.error('reply to is : {}'.format(reply_to))
        message = self.request.get('message')
        to_address = config.from_server_email_address

        message = self.render_str(
            'email_feedback.html', reply_to=reply_to, message=message,
        )

        mandrill.send(
            to_address=to_address,
            subject="Feedback on the mindset meter",
            body=message,
        )

        logging.info('Feedback Email sent to ' + to_address + ' with the message ' + message)
        self.write_json({'ok': True})


class PageNotFoundHandler(Handler):

    def get(self):
        self.render('404.html')


app = webapp2.WSGIApplication([
    ('/', MainHandler),
    ('/take/(.*)', TakeHandler),
    ('/complete/(.*)', CompleteHandler),
    webapp2.Route(r'/results/<keys_str>', handler=ResultsHandler),
    webapp2.Route(r'/results/<metric>/<keys_str>', handler=ResultsHandler),
    ('/sample/(.*)', SampleHandler),
    ('/share/(.*)', ShareHandler),
    ('/csv', CsvHandler),
    ('/api/metric', MetricApi),
    ('/admin/api/metric', AdminMetricApi),
    ('/api/result', ResultApi),
    ('/api/keys', KeysApi),
    ('/api/error', ErrorApi),
    ('/api/email', EmailApi),
    ('/api/email_feedback', EmailFeedback),
    ('/admin/data', AdminDataHandler),
    ('/admin/create', AdminCreateHandler),
    ('/.*', PageNotFoundHandler)
], debug=True)
