/// <reference path="./typings/tsd.d.ts"/>
var express = require('express');
var bodyParser = require('body-parser');
var session = require('express-session');
var logger = require('morgan');

var mongodb = require('mongodb');
var Q = require('q');
Q.longStackSupport = true;

var cqrs = require('./src/cqrs4');
var EventProvider = cqrs.EventProvider;
var StoredEventProvider = cqrs.StoredEventProvider;
var EventHandler = cqrs.EventHandler;
var Context = cqrs.Context;
var MongoProjection = cqrs.MongoProjection;
var DomainEvent = cqrs.DomainEvent;



/////////////////////
// server
var initServer = function (db) {
    var domainEvents = {
        activityAdded: new DomainEvent('activityAdded', 'appContext', db)
    };

    var projections = {
        allActivitiesProjection: new MongoProjection('allActivities', db, function (collection) {
            domainEvents.activityAdded.handle(function (activity, user) {
                var doc = activity;
                doc.owner_name = user.name;
                collection.insert(doc);
            });
        }),
        providerActivitiesProjection: new MongoProjection('allActivities', db, function (collection) {
            domainEvents.activityAdded.handle(function (activity, user) {
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

    // loadtest -n 1000 -c 4 -T "Content-Type: application/json" -P "{}" http://localhost:3000/activity
    // ab -c 4 -n 10000 -T "Content-Type: application/json" -p test.data.json http://127.0.0.1:3000/activity
    app.post('/activity', function (req, res) {
        var params = req.body;

        params = {
            desc: 'Nabada',
            bookableItems: [
                {
                    name: "Wildes Nabada",
                    price: 0,
                    quantity: 20000
                }, {
                    name: "After Party",
                    price: 8,
                    quantity: 5000
                }
            ]
        };

        if (req.session.isAuth()) {
            context.domainEvents.activityAdded.emit(params, req.session.user);
            res.json({ ok: true });
        }
    });

    app.get('/activities', function (req, res) {
        context.projections.allActivitiesProjection.query({}).then(function (activities) {
            res.json(activities);
        }).done();
    });
}).done();
//# sourceMappingURL=RESTexample4.js.map
