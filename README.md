Mindset Meter
================================

The mindset meter is a tool for anyone to take and share well validated psychometrics.
This document describes how to contribute to its development.

*benjamin.haley@gmail.com November 2012*

##

### Contributing

1. Read this document.
2. Add all significant changes to the [design page][design page link]
3. Add code, commit to git, deploy, and smile.

### Philosophy

The mindset meter believes that the best tool is a hammer.  Simple, powerful, and versatile, hammers are useful for many problems, seldom break, and do not tax the patients of the user.  By contrast, the worst tool is Blackboard. Complex, single purpose, and ripe with frustrations, Blackboard makes the world worse.  Before you add code, ask yourself, 'Am I coding hammers or Blackboard?'

### Basics

Mindset meter is built using python and google app engine with their basic web application framework.  Rather than solving the specific problem of conducting surveys on users, it solves a more general problem, how to solicit user input and give them a response that can optionally be shared with other users.  Surveys and responses will be coded dynamically and could easily be replaced with any user interaction.

### Documentation

The [design page][design page link] lists all user facing pages, apis, and database structure.  It also contains a brief walk through.  It exists as a single page which has the advantage of allowing contributors to get a sense of the project in a single glance and inhibiting feature bloat because its hard to fit too many features on a single design page.

More detailed documentation is to be found in the code itself.

### Files and Folders:
- [main.py][main.py link] interecepts all calls to the server and should be explored first.
- [templates folder][templates folder link] holds all html.
- [js][js folder link] and [css][css folder link] folders, as they sound.
- [static][static folder link] stores images and repository-controlled html files.
- [util.py][util.py link] holds all sorts of miscellaneous functions without dependencies.
- [mindsetMeter.js][mindsetMeter.js link] holds the bulk of all javascript which can be called using the mm object.
- [app.yaml][app.yaml link] defines basic routing rules including [static folders][static folders documentation] and which domains require special privlages (domains starting with /admin/ require [administrator access][administrator access documenation] to the google app engine code for mindsetmeter)

### Coding Conventions

- javascript should pass [jslint][jslint link] using the following directives
```
/*jslint browser: true*/
/*jslint indent: 2 */
/*global $ */
```

[design page link]: https://docs.google.com/drawings/d/1khG58r8MNgF5y3N1JJOu4qn7CfdkDEBXK9k8rSe6B7g/edit?usp=asogm

[main.py link]: https://github.com/daveponet/mindsetmeter/blob/master/main.py
[templates folder link]: https://github.com/daveponet/mindsetmeter/tree/master/templates
[js folder link]: https://github.com/daveponet/mindsetmeter/tree/master/js
[css folder link]: https://github.com/daveponet/mindsetmeter/tree/master/css
[util.py link]: https://github.com/daveponet/mindsetmeter/blob/master/util.py
[mindsetMeter.js link]: https://github.com/daveponet/mindsetmeter/blob/master/js/mindsetMeter.js
[jslint link]: [http://jslint.com]
[app.yaml link]: [https://github.com/daveponet/mindsetmeter/blob/master/app.yaml]
[static folder link]: https://github.com/daveponet/mindsetmeter/tree/master/static
[administrator access documenation]: https://developers.google.com/appengine/docs/python/config/appconfig#Requiring_Login_or_Administrator_Status
[static folders documentation]: https://developers.google.com/appengine/docs/python/gettingstarted/staticfiles

### Using Compass

This application uses Compass to compile CSS stylesheets from SCSS files.  Compass allows for nested styles, cross-browser mixins, variables, and much more.

To make any CSS changes, make adjustments to the files in `/sass` and run the commands below to compile CSS to be read by the application.

#### Local Server
```
$ compass watch
```
Watches `.scss` files to recompile corresponding `.css` so you can see changes locally as you update the files.

#### Production
```
$ compass compile -e production --force
```
Builds a minified production stylesheet

See [this Google Doc](https://docs.google.com/document/d/184dsSF-esWgJ-TS_da3--UkFNb1oIur-r99X-7Xmhfg/edit#heading=h.auep2os4njjj) for more information on using and setting up Compass

### Deployment

For previewing changes and testing:

```
gcloud app deploy app.yaml --project=mindsetmeter --version=staging --no-promote
```

Then visit [staging-dot-mindsetmeter.appspot.com](https://staging-dot-mindsetmeter.appspot.com).

For production:

```
gcloud app deploy app.yaml --project=mindsetmeter --version=1 --no-promote
```

Then visit [survey.perts.net](https://survey.perts.net).

