from google.appengine.api import urlfetch
import json
import jinja2
import config
import util
import logging


# Setup jinja2 environment using the email subdirectory in templates
JINJA_ENVIRONMENT = jinja2.Environment(
    loader=jinja2.FileSystemLoader('templates/emails'),
    extensions=['jinja2.ext.autoescape'],
    autoescape=True)


def send(template_data={}, **kwargs):

    # Determine if message should send
    if util.is_localhost() and not config.should_deliver_smtp_dev:
        logging.info('Email not sent, check config!')
        return None

    subject = render(kwargs['subject'], **template_data)

    # Determine if using html string or a template
    body = ''
    if 'body' in kwargs:
        body = render(kwargs['body'], **template_data)
    elif 'template' in kwargs:
        body = render_template(kwargs['template'], **template_data)

    # JSON for Mandrill HTTP POST request
    json_mandrill = {
        "key": config.mandrill_api_key,
        "message": {
            "html": body,
            "subject": subject,
            "from_email": config.from_server_email_address,
            "from_name": config.from_server_name,
            "inline_css": True,
            "to": format_to_address(kwargs['to_address'])
        }
    }

    # URL for Mandrill HTTP POST request
    url = "https://mandrillapp.com/api/1.0/messages/send.json"
    rpc = urlfetch.create_rpc()
    urlfetch.make_fetch_call(
        rpc,
        url=url,
        payload=json.dumps(json_mandrill),
        method=urlfetch.POST,
        headers={'Content-Type': 'application/x-www-form-urlencoded'})

    try:
        result = rpc.get_result()
    except urlfetch.DownloadError:
        # Request timed out or failed. On localhost this can be from network
        # issues.
        logging.error("Mandrill RPC failed.")
        return None

    result_info = json.loads(result.content)[0]

    logging.info("Mandrill response: {} {}"
                 .format(result.status_code, result_info))

    if result.status_code == 200:
        if result_info['status'] != 'sent':
            logging.error("Email failed to send.")
    else:
        logging.error("Mandrill response wasn't a 200.")

    return result


# Formats the "to" field to fit conventions
def format_to_address(unformatted_to):
    formatted_to = []
    # Handles list of strings or single string
    for email in unformatted_to if not isinstance(unformatted_to, basestring) else [unformatted_to]:
        formatted_to.append({
            "email": email,
            "type": "to"
        })
    return formatted_to


# Creates email html from a string using jinja2
def render(s, **template_data):
    return jinja2.Environment().from_string(s).render(**template_data)


# Loads email html from a template using jinja2
def render_template(template, **template_data):
    return JINJA_ENVIRONMENT.get_template(template).render(**template_data)