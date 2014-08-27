/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

var Joi = require('joi');

var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs5');
var helpers = require('./src/helpers');
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;
var DomainEvent = cqrs.DomainEvent;

var Entities = require('./entities');

/////////////////////
// server
var initServer = function (db) {
    var domainEvents = {
        activityCreated: new DomainEvent('activityCreated', 'appContext', db),
        activityUpdated: new DomainEvent('activityUpdated', 'appContext', db),
        activityDeleted: new DomainEvent('activityDeleted', 'appContext', db)
    };

    var projections = {
        allActivitiesProjection: new helpers.MongoCURDProjection('allActivities', db, domainEvents.activityCreated, domainEvents.activityUpdated, domainEvents.activityDeleted),
        providerActivitiesProjection: new MongoProjection('allActivities', db, function (collection) {
            domainEvents.activityCreated.handle(function (activity, user) {
                var doc = activity;
                doc.owner = user._id;
                collection.insert(doc);
            });
        })
    };

    return {
        domainEvents: domainEvents,
        projections: projections
    };
};

// running
var app = express();
app.set('json spaces', '  ');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(session({ secret: 'bak-gAt-arC-eF', resave: true, saveUninitialized: true }));

// open mongodb connection
Q.nfcall(mongodb.MongoClient.connect, 'mongodb://127.0.0.1:27017/cqrs').then(function (db) {
    var context = initServer(db);

    app.listen(3000, function () {
        console.info('Server is running!');
    });

    var theUser = {
        name: "Jonathan",
        email: "sqrs-test@dreampulse.de",
        password: "secret",
        _id: new mongodb.ObjectID()
    };

    // assume a session
    // usually you would do this via passport or so
    app.use(function (req, res, next) {
        req.session.user = theUser;
        req.session.isAuth = function () {
            return true;
        };
        next();
    });

    // projection
    app.get('/activities', function (req, res) {
        context.projections.allActivitiesProjection.query({}).then(function (activities) {
            res.json(activities);
        }).done();
    });

    ///////////// private API-Part
    app.use(function (req, res, next) {
        if (req.session.isAuth())
            next();
        else
            res.status(401).send({ 'ok': false, 'err': 'not logged in' });
    });

    app.put('/activity', function (req, res) {
        var params = req.body;

        Joi.assert(params, Entities.ActivitySchema);

        if (req.session.isAuth()) {
            context.domainEvents.activityCreated.emit(params, req.session.user);
            res.json({ ok: true });
        }
    });

    // update
    app.post('/activity', function (req, res) {
        var params = req.body;

        Joi.assert(params, Entities.ActivitySchema.keys({ _id: Joi.string().required() }).required());
        params._id = new mongodb.ObjectID(req.body._id);

        if (req.session.isAuth()) {
            context.domainEvents.activityUpdated.emit(params, req.session.user);
            res.json({ ok: true });
        }
    });

    // delete
    app.delete('/activity', function (req, res) {
        var params = req.body;

        Joi.assert(params, Joi.object().keys({ _id: Joi.string().required() }).required());
        params._id = new mongodb.ObjectID(req.body._id);

        if (req.session.isAuth()) {
            context.domainEvents.activityDeleted.emit(params, req.session.user);
            res.json({ ok: true });
        }
    });
}).done();
// loadtest -n 1000 -c 4 -T "Content-Type: application/json" -P "{}" http://localhost:3000/activity
// ab -c 1 -n 1 -T "Content-Type: application/json" -u test.data.json http://127.0.0.1:3000/activity
// curl -X PUT -H "Content-Type: application/json" --data @test.data.json http://localhost:3000/activity
//# sourceMappingURL=RESTexample5.js.map
